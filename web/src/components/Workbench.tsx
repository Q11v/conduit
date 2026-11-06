import { useCallback, useRef, useState } from 'react'
import { Btn as BaseBtn } from './ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Star } from './Icons'
import { createPreset, why } from '../api'
import { notifyError } from '../lib/notifications'
import { destinationRefreshTokens } from '../lib/job-state'
import { FilePane } from './FilePane'
import type { useConduit } from '../useConduit'
import type { WorkspaceSettings } from '../types'
import type { DragFiles, Side } from '../lib/workspace'
function Btn({ className = '', ...props }: React.ComponentProps<typeof BaseBtn>) {
  return (
    <BaseBtn {...props} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs ${className}`} />
  )
}
type Controller = ReturnType<typeof useConduit>
const field =
  'h-9 min-w-0 rounded-lg border field-edge sunken px-3 text-[13px] text-fg outline-none focus:border-violet'
export function Workbench(props: { c: Controller; onManage: () => void }) {
  if (!props.c.preferences.settings)
    return (
      <p className="text-xs text-mute">
        {props.c.preferences.error ? '请通过顶部配置文件入口修复或恢复配置。' : '读取工作台设置…'}
      </p>
    )
  return <Workspace {...props} initial={props.c.preferences.settings} />
}
function Workspace({ c, onManage, initial }: { c: Controller; onManage: () => void; initial: WorkspaceSettings }) {
  const updatePreferences = c.preferences.update
  const [local, setLocalValue] = useState(initial.localDirectory)
  const [remote, setRemoteValue] = useState(initial.remoteDirectory)
  const [localFiles, setLocalFiles] = useState<string[]>([])
  const [remoteFiles, setRemoteFiles] = useState<string[]>([])
  const localFavorites = c.preferences.settings?.localFavorites ?? []
  const bookmarks = c.preferences.settings?.bookmarks ?? []
  const [dialog, setDialog] = useState<'bookmark' | 'push' | 'pull' | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState<DragFiles | null>(null)
  const [split, setSplit] = useState(50)
  const panes = useRef<HTMLDivElement>(null)
  const refreshTokens = destinationRefreshTokens(c.jobs)
  const server = c.pullServer
  const setLocal = useCallback(
    (path: string) => {
      setLocalValue(path)
      void updatePreferences({ localDirectory: path }).catch(e => notifyError(String(e)))
    },
    [updatePreferences]
  )
  const setRemote = useCallback(
    (path: string) => {
      setRemoteValue(path)
      void updatePreferences({ remoteDirectory: path }).catch(e => notifyError(String(e)))
    },
    [updatePreferences]
  )
  const chooseServer = (id: string) => {
    c.choosePullServer(id)
    setRemote(c.servers.find(s => s.id === id)?.dirs[0] || '~')
    setRemoteFiles([])
  }
  const toggleLocalFavorite = (path: string) => {
    const next = localFavorites.includes(path) ? localFavorites.filter(p => p !== path) : [...localFavorites, path]
    void updatePreferences({ localFavorites: next }).catch(e => notifyError(String(e)))
  }
  const save = async () => {
    if (!server || !name.trim() || saving) return
    setSaving(true)
    try {
      if (dialog === 'bookmark') {
        await updatePreferences({
          bookmarks: [...bookmarks, { id: crypto.randomUUID(), name: name.trim(), local, serverId: server.id, remote }]
        })
      } else {
        const result = await createPreset(
          dialog === 'push'
            ? {
                kind: 'push',
                name: name.trim(),
                src: localFiles[0],
                targets: [{ serverId: server.id, dir: remote }],
                adhoc: []
              }
            : { kind: 'pull', name: name.trim(), serverId: server.id, paths: remoteFiles, localDir: local }
        )
        if (!result.ok) {
          setMessage(why(result))
          return
        }
        await c.reloadPresets()
      }
      setDialog(null)
      setMessage('')
    } catch (e) {
      setMessage(String(e))
    } finally {
      setSaving(false)
    }
  }
  const upload = async (paths = localFiles) => {
    if (!server || sending) return
    setSending(true)
    try {
      for (const source of paths) await c.runPush(source, [{ serverId: server.id, dir: remote }])
    } finally {
      setSending(false)
    }
  }
  const dropFiles = (side: Side, files: File[]) => {
    const source = dragging
    setDragging(null)
    setMessage('')
    if (!server) return
    if (source) {
      if (source.side === side) return
      if (source.side === 'remote' && source.serverId !== server.id) {
        notifyError('服务器已切换，请重新选择要拉取的文件')
        return
      }
      if (side === 'remote') void upload(source.paths)
      else void c.runPull(server.id, source.paths, local)
    } else if (side === 'remote') {
      try {
        const paths = files.map(f => window.desktop.pathForFile(f)).filter((p): p is string => !!p)
        if (paths.length) void upload(paths)
        else notifyError('无法读取拖入文件的本地路径')
      } catch (e) {
        notifyError(String(e))
      }
    }
  }
  const openSave = (kind: 'bookmark' | 'push' | 'pull') => {
    setDialog(kind)
    setName('')
    setMessage('')
  }
  return (
    <div className="flex min-h-[460px] flex-1 flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold">工作台</h1>
          <p className="mt-1.5 text-[13px] text-mute">左侧本地，右侧服务器。选择文件后上传或拉取。</p>
        </div>
        <Btn onClick={onManage}>管理服务器</Btn>
      </div>
      <nav
        aria-label="位置书签"
        className="mb-4 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-violet/20 bg-violet/5 p-3 text-xs"
      >
        <span
          className="mr-2 flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-violet-text"
          title="同时切换本地目录、服务器和远端目录"
        >
          <Star size={14} />
          书签
        </span>
        {bookmarks.map(b => (
          <span
            key={b.id}
            className={`group flex h-9 items-center rounded-lg border ${server?.id === b.serverId && local === b.local && remote === b.remote ? 'border-violet/50 bg-violet/20 text-fg' : 'border-violet/20 bg-ink-panel text-fg-dim hover:border-violet/40 hover:bg-violet/10'}`}
          >
            <button
              className="h-full px-3 text-[13px] font-medium cursor-pointer hover:text-violet-text"
              title={`切换两侧位置：${b.local} ↔ ${c.servers.find(s => s.id === b.serverId)?.name ?? '服务器已删除'}:${b.remote}`}
              onClick={() => {
                if (!c.servers.some(s => s.id === b.serverId)) {
                  notifyError('这个书签的服务器已被删除')
                  return
                }
                chooseServer(b.serverId)
                setLocal(b.local)
                setRemote(b.remote)
                setLocalFiles([])
              }}
            >
              {b.name}
            </button>
            <button
              aria-label={`删除书签 ${b.name}`}
              className="mr-1 rounded px-1.5 py-1 text-mute opacity-50 hover:bg-fg/8 hover:text-fg hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
              onClick={() => {
                void c.preferences
                  .update({ bookmarks: bookmarks.filter(x => x.id !== b.id) })
                  .catch(e => notifyError(String(e)))
              }}
            >
              ×
            </button>
          </span>
        ))}
        <Btn variant="violet" className="ml-auto" disabled={!server} onClick={() => openSave('bookmark')}>
          <Star size={12} /> 保存为书签
        </Btn>
      </nav>
      <div
        ref={panes}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,var(--left-pane))_8px_minmax(0,var(--right-pane))] gap-3"
        style={{ '--left-pane': `${split}fr`, '--right-pane': `${100 - split}fr` } as React.CSSProperties}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <FilePane
            title="本地"
            onPickDirectory={async () => {
              const p = await window.desktop.pick({ dir: true, defaultPath: local })
              if (p) {
                setLocal(p)
                setLocalFiles([])
              }
            }}
            home={c.hosts?.home}
            favorites={localFavorites}
            onFavorite={toggleLocalFavorite}
            location={local}
            selected={localFiles}
            onSelect={setLocalFiles}
            onLocation={setLocal}
            refreshToken={refreshTokens.local}
            dragSource={dragging?.side ?? null}
            onDragFiles={setDragging}
            onDragFinish={() => setDragging(null)}
            onDropFiles={files => dropFiles('local', files)}
          />
          <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
            <Btn
              disabled={!server || localFiles.length !== 1}
              title="当前版本支持把单个文件或整个目录存为上传方案"
              onClick={() => openSave('push')}
            >
              存为上传方案
            </Btn>
            <Btn
              variant="primary"
              disabled={!server || !localFiles.length || sending || !remote.trim()}
              onClick={() => void upload()}
            >
              {sending ? '正在添加…' : `上传${localFiles.length ? ` ${localFiles.length} 项` : ''} →`}
            </Btn>
          </div>
        </div>
        <div
          role="separator"
          aria-label="调整左右面板宽度"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={70}
          aria-valuenow={Math.round(split)}
          tabIndex={0}
          className="flex touch-none cursor-col-resize items-center justify-center rounded-md hover:bg-fg/5 focus-visible:outline-cyan"
          onKeyDown={e => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault()
              setSplit(v =>
                e.key === 'Home'
                  ? 30
                  : e.key === 'End'
                    ? 70
                    : Math.max(30, Math.min(70, v + (e.key === 'ArrowLeft' ? -2 : 2)))
              )
            }
          }}
          onPointerDown={e => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={e => {
            if (e.currentTarget.hasPointerCapture(e.pointerId) && panes.current) {
              const rect = panes.current.getBoundingClientRect()
              setSplit(Math.max(30, Math.min(70, ((e.clientX - rect.left) / rect.width) * 100)))
            }
          }}
          onPointerUp={e => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
          }}
        >
          <span className="h-12 w-0.5 rounded bg-fg/15" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <FilePane
            refreshToken={refreshTokens.remote}
            dragSource={dragging?.side ?? null}
            onDragFiles={setDragging}
            onDragFinish={() => setDragging(null)}
            onDropFiles={files => dropFiles('remote', files)}
            key={server?.id ?? 'empty'}
            title="服务器"
            serverLabel={server ? `${server.name} (${server.host})` : ''}
            favorites={server?.dirs ?? []}
            onFavorite={path => {
              setMessage('')
              if (server) {
                if (server.dirs.includes(path)) c.unpinPath(server.id, path)
                else c.pinPath(server.id, path)
              }
            }}
            location={remote}
            serverId={server?.id ?? ''}
            selected={remoteFiles}
            onSelect={setRemoteFiles}
            onLocation={setRemote}
          >
            <select
              aria-label="选择服务器"
              className={`${field} ml-auto max-w-[65%]`}
              value={server?.id ?? ''}
              onChange={e => chooseServer(e.target.value)}
            >
              {!server && <option value="">请选择服务器</option>}
              {c.servers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FilePane>
          <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
            <Btn
              variant="cyan"
              disabled={!server || !remoteFiles.length || !local.trim()}
              onClick={() => server && void c.runPull(server.id, remoteFiles, local)}
            >
              ← 拉取{remoteFiles.length ? ` ${remoteFiles.length} 项` : ''}
            </Btn>
            <Btn disabled={!server || !remoteFiles.length} onClick={() => openSave('pull')}>
              存为拉取方案
            </Btn>
          </div>
        </div>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={open => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{dialog === 'bookmark' ? '保存位置书签' : '保存传输方案'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <p className="text-xs text-mute break-all">
              {local} ↔ {server?.name}：{remote}
            </p>
            <input
              autoFocus
              aria-label="名称"
              placeholder={dialog === 'bookmark' ? '书签名称' : '方案名称'}
              className={`${field} w-full`}
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <Btn disabled={!name.trim() || saving} onClick={() => void save()}>
              {saving ? '保存中…' : '保存'}
            </Btn>
            {message && (
              <p role="alert" className="text-xs text-err-text">
                {message}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
