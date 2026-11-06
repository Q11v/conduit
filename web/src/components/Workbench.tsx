import { useEffect, useRef, useState } from 'react'
import { Btn as BaseBtn } from './ui'
import { Checkbox } from './ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { DirectoryBar } from './DirectoryBar'
import { FileIcon, Folder, Star, Trash } from './Icons'
import { browse, createPreset, deleteRemoteFiles, formatSize, why } from '../api'
import { destinationRefreshTokens } from '../lib/job-state'
import type { Listing } from '../types'
import { formatModified, sortEntries, type FileSort, type SortKey } from '../lib/file-list'
import type { useConduit } from '../useConduit'

function Btn({ className = '', ...props }: React.ComponentProps<typeof BaseBtn>) {
  return (
    <BaseBtn {...props} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs ${className}`} />
  )
}

const FILE_DRAG = 'application/x-conduit-files'
type Side = 'local' | 'remote'
type DragFiles = { side: Side; paths: string[]; serverId?: string }

type Controller = ReturnType<typeof useConduit>
type Bookmark = { id: string; name: string; local: string; serverId: string; remote: string }
const join = (dir: string, name: string) => `${dir.replace(/\/$/, '')}/${name}`
const parent = (dir: string) => dir.replace(/\/[^/]+\/?$/, '') || '/'
const field =
  'h-9 min-w-0 rounded-lg border field-edge sunken px-3 text-[13px] text-fg outline-none focus:border-violet'

function loadBookmarks(): Bookmark[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('conduit.bookmarks') || '[]')
    return Array.isArray(value)
      ? value.filter(
          (b): b is Bookmark => b && ['id', 'name', 'local', 'serverId', 'remote'].every(k => typeof b[k] === 'string')
        )
      : []
  } catch {
    return []
  }
}

function loadLocalFavorites(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('conduit.local-favorites') || 'null')
    if (Array.isArray(stored))
      return [...new Set(stored.filter((p): p is string => typeof p === 'string' && !!p.trim()))]
  } catch {
    /* Use the default directories if storage is unavailable. */
  }
  return ['~/Downloads', '~/Desktop', '~/Documents']
}

function FilePane({
  title,
  deletionBlocked,
  location,
  serverId,
  serverLabel,
  selected,
  onSelect,
  onLocation,
  onPickDirectory,
  home,
  favorites,
  onFavorite,
  refreshToken,
  dragSource,
  onDragFiles,
  onDragFinish,
  onDropFiles,
  children
}: {
  title: string
  deletionBlocked: boolean
  location: string
  serverId?: string
  serverLabel?: string
  selected: string[]
  onSelect: (paths: string[]) => void
  onLocation: (path: string) => void
  onPickDirectory?: () => void
  home?: string
  favorites: string[]
  onFavorite: (path: string) => void
  refreshToken: string
  dragSource: Side | null
  onDragFiles: (files: DragFiles) => void
  onDragFinish: () => void
  onDropFiles: (files: File[]) => void
  children?: React.ReactNode
}) {
  const [input, setInput] = useState(location)
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  const [sort, setSort] = useState<FileSort>({ key: 'name', descending: false })
  const [dropOver, setDropOver] = useState(false)
  const dragDepth = useRef(0)
  const side: Side = serverId === undefined ? 'local' : 'remote'
  const accepts = (e: React.DragEvent) =>
    !!listing &&
    !loading &&
    ((e.dataTransfer.types.includes(FILE_DRAG) && dragSource !== null && dragSource !== side) ||
      (side === 'remote' && e.dataTransfer.types.includes('Files')))
  const changeSort = (key: SortKey) =>
    setSort(previous => ({ key, descending: previous.key === key ? !previous.descending : key !== 'name' }))
  useEffect(() => {
    let active = true
    const refresh = async () => {
      await Promise.resolve()
      if (!active) return
      setInput(location)
      setListing(previous => (previous?.path === location ? previous : null))
      setError('')
      setLoading(false)
      if (!location || serverId === '') return
      setLoading(true)
      try {
        const r =
          serverId === undefined
            ? await (window.desktop?.list?.(location) ??
                Promise.resolve({ ok: false as const, error: '请在桌面应用中浏览本地文件' }))
            : await browse(serverId, location)
        if (!active) return
        if (r.ok && 'path' in r) {
          setListing(r as Listing)
          setInput(r.path)
          if (r.path !== location) onLocation(r.path)
          if (r.select) onSelect([r.select])
        } else setError(why(r))
      } catch (e) {
        if (active) setError(String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    void refresh()
    return () => {
      active = false
    }
  }, [location, serverId, revision, onLocation, onSelect, refreshToken])
  const toggle = (path: string) =>
    onSelect(selected.includes(path) ? selected.filter(p => p !== path) : [...selected, path])
  const canonical = (path: string) => (home && (path === '~' || path.startsWith('~/')) ? home + path.slice(1) : path)
  const favoritePath = favorites.find(path => canonical(path) === listing?.path)
  const entries = sortEntries(listing?.entries ?? [], sort)
  const navigate = (path: string) => {
    if (deleting) return
    setDeleteError('')
    onSelect([])
    onLocation(path)
  }
  const deleteSelected = async () => {
    if (!listing || !selected.length || deleting || deletionBlocked || loading) return
    const directory = listing.path
    const paths = [...selected]
    setDeleting(true)
    setDeleteError('')
    let attempted = false
    try {
      const remote = serverId !== undefined
      const confirmed = await window.desktop.confirm(
        remote ? `从服务器删除 ${paths.length} 项？` : `将 ${paths.length} 项移到废纸篓？`,
        `${remote ? '远端删除无法撤销，文件夹及其内容会一并删除。' : '文件夹及其内容会一起移到废纸篓。'}\n\n${serverId ? `服务器：${serverLabel || serverId}\n` : ''}${paths.join('\n')}`,
        remote ? '永久删除' : '移到废纸篓'
      )
      if (!confirmed) return
      attempted = true
      const result = remote
        ? await deleteRemoteFiles(serverId, directory, paths)
        : await window.desktop.trash(directory, paths)
      if (!result.ok) setDeleteError(why(result))
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      if (attempted) {
        onSelect([])
        setRevision(v => v + 1)
      }
      setDeleting(false)
    }
  }
  return (
    <section
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-xl border hair-2 panel ${dropOver ? 'ring-2 ring-cyan' : ''}`}
      onDragEnter={e => {
        if (accepts(e)) {
          e.preventDefault()
          dragDepth.current++
          setDropOver(true)
        }
      }}
      onDragOver={e => {
        if (accepts(e)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDropOver(false)
      }}
      onDrop={e => {
        const accepted = accepts(e)
        e.preventDefault()
        dragDepth.current = 0
        setDropOver(false)
        if (accepted) onDropFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b hair px-4">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        {children}
        {selected.length > 0 && (
          <Btn
            disabled={deleting || deletionBlocked || loading}
            title={
              deletionBlocked ? '传输进行中，请完成后再删除' : serverId === undefined ? '移到废纸篓' : '删除远端文件'
            }
            onClick={() => void deleteSelected()}
            className="ml-auto text-err-text"
          >
            <Trash size={13} />
            {deleting ? '删除中…' : `删除所选 (${selected.length})`}
          </Btn>
        )}
      </div>
      <DirectoryBar
        title={title}
        value={input}
        path={listing?.path ?? null}
        loading={loading}
        onChange={setInput}
        onPick={onPickDirectory}
        onGo={path => {
          navigate(path)
          setRevision(v => v + 1)
        }}
      />
      <div className="h-[min(50vh,480px)] min-h-[250px] overflow-auto">
        {(error || deleteError) && (
          <p role="alert" className="px-4 py-5 text-xs text-err-text break-words whitespace-pre-line">
            {deleteError || error}
          </p>
        )}
        {!loading && !error && serverId === '' && (
          <p className="px-4 py-10 text-center text-xs text-mute">选择或添加一台服务器</p>
        )}
        <table className="w-full min-w-[440px] table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-[76px]" />
            <col className="w-[142px]" />
          </colgroup>
          <thead className="sticky top-0 z-1 bg-ink-panel text-mute">
            <tr className="h-9 border-b hair text-left">
              <th className="pl-4 font-normal">
                <Checkbox
                  aria-label={`全选${title}当前目录`}
                  disabled={!entries.length}
                  checked={entries.length > 0 && entries.every(e => selected.includes(join(listing!.path, e.name)))}
                  onCheckedChange={checked => onSelect(checked ? entries.map(e => join(listing!.path, e.name)) : [])}
                />
              </th>
              {(
                [
                  ['name', '名称'],
                  ['size', '大小'],
                  ['modifiedAt', '修改时间']
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}
                  className="font-normal"
                >
                  <button
                    className={`h-9 w-full cursor-pointer pr-3 text-left hover:text-fg ${sort.key === key ? 'text-fg' : ''}`}
                    onClick={() => changeSort(key)}
                  >
                    {label}
                    {sort.key === key ? (sort.descending ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listing && listing.path !== '/' && (
              <tr className="h-9 border-b hair">
                <td colSpan={4}>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-2 pl-10 pr-4 text-left text-xs text-mute hover:bg-white/3 hover:text-fg cursor-pointer"
                    title="返回上一级目录"
                    aria-label={`${title}：返回上一级目录`}
                    onClick={() => navigate(parent(listing.path))}
                  >
                    <Folder size={16} className="pointer-events-none shrink-0 text-warn-text" />
                    <span className="font-mono">..</span>
                  </button>
                </td>
              </tr>
            )}
            {entries.map(e => {
              const path = join(listing!.path, e.name)
              return (
                <tr
                  key={e.name}
                  className={`h-10 border-b hair ${selected.includes(path) ? 'bg-violet/10' : 'hover:bg-white/3'}`}
                >
                  <td className="pl-4">
                    <Checkbox
                      aria-label={`选择 ${title} ${e.name}`}
                      checked={selected.includes(path)}
                      onCheckedChange={() => toggle(path)}
                    />
                  </td>
                  <td className="pr-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={event => {
                        const paths = selected.includes(path) ? selected : [path]
                        if (!selected.includes(path)) onSelect(paths)
                        event.dataTransfer.effectAllowed = 'copy'
                        event.dataTransfer.setData(FILE_DRAG, JSON.stringify({ side, paths, serverId }))
                        onDragFiles({ side, paths, serverId })
                      }}
                      onDragEnd={onDragFinish}
                      className="flex w-full min-w-0 select-none items-center gap-2 text-left text-[13px] cursor-pointer active:cursor-grabbing"
                      title={path}
                      onClick={() => (e.type === 'dir' ? navigate(path) : toggle(path))}
                    >
                      {e.type === 'dir' ? (
                        <Folder size={16} className="pointer-events-none shrink-0 text-warn-text" />
                      ) : (
                        <FileIcon size={16} className="pointer-events-none shrink-0 text-[#a8b9d1]" />
                      )}
                      <span className="pointer-events-none min-w-0 truncate">{e.name}</span>
                    </button>
                  </td>
                  <td
                    className="pr-3 tabular-nums text-mute"
                    title={e.size == null ? undefined : `${e.size.toLocaleString()} 字节`}
                  >
                    {e.type === 'dir' || e.size == null ? '—' : formatSize(e.size)}
                  </td>
                  <td className="pr-3 tabular-nums whitespace-nowrap text-mute">{formatModified(e.modifiedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {listing?.truncated && (
          <p className="p-4 text-xs text-mute">仅显示前 {entries.length} 项，可输入路径进入其他目录。</p>
        )}
      </div>
      {dropOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-cyan/10 pb-12">
          <span className="rounded-lg bg-ink-float px-4 py-2 text-sm text-cyan shadow-lg">
            松开以{side === 'remote' ? '上传到' : '拉取到'}当前目录
          </span>
        </div>
      )}
      <div className="flex h-14 shrink-0 items-center gap-2 border-t hair px-3 text-xs">
        <span className="shrink-0 text-mute">常用目录</span>
        <div className="flex h-11 min-w-0 flex-1 items-start gap-1.5 overflow-x-auto overflow-y-hidden pt-1.5">
          {['~', ...favorites.filter(d => d !== '~')].map(dir => (
            <button
              key={dir}
              type="button"
              title={dir}
              onClick={() => navigate(dir)}
              className={`h-7 max-w-[180px] shrink-0 truncate rounded-md border hair-2 px-2 cursor-pointer hover:bg-white/8 hover:text-fg ${canonical(dir) === listing?.path ? 'bg-violet/10 text-violet-text' : 'text-mute'}`}
            >
              {dir}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!listing || loading}
          aria-label={`${favoritePath !== undefined ? '取消收藏' : '收藏'}${title}当前目录`}
          title={favoritePath !== undefined ? '取消收藏当前目录' : '收藏当前目录'}
          onClick={() => listing && onFavorite(favoritePath ?? listing.path)}
          className={`shrink-0 cursor-pointer rounded-md p-1.5 hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed ${favoritePath !== undefined ? 'text-warn-text' : 'text-mute'}`}
        >
          <Star size={14} />
        </button>
      </div>
    </section>
  )
}

export function Workbench({ c, onManage }: { c: Controller; onManage: () => void }) {
  const [local, setLocal] = useState(c.pullDir || '~')
  const [remote, setRemote] = useState('~')
  const [localFiles, setLocalFiles] = useState<string[]>([])
  const [remoteFiles, setRemoteFiles] = useState<string[]>([])
  const [localFavorites, setLocalFavorites] = useState(loadLocalFavorites)
  const [bookmarks, setBookmarks] = useState(loadBookmarks)
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
  const chooseServer = (id: string) => {
    c.choosePullServer(id)
    setRemote(c.servers.find(s => s.id === id)?.dirs[0] || '~')
    setRemoteFiles([])
  }
  const toggleLocalFavorite = (path: string) => {
    const next = localFavorites.includes(path) ? localFavorites.filter(p => p !== path) : [...localFavorites, path]
    try {
      localStorage.setItem('conduit.local-favorites', JSON.stringify(next))
      setLocalFavorites(next)
      setMessage('')
    } catch (e) {
      setMessage(String(e))
    }
  }
  const persistBookmarks = (next: Bookmark[]) => {
    localStorage.setItem('conduit.bookmarks', JSON.stringify(next))
    setBookmarks(next)
  }
  const save = async () => {
    if (!server || !name.trim() || saving) return
    setSaving(true)
    try {
      if (dialog === 'bookmark') {
        persistBookmarks([
          ...bookmarks,
          { id: crypto.randomUUID(), name: name.trim(), local, serverId: server.id, remote }
        ])
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
        setMessage('服务器已切换，请重新选择要拉取的文件')
        return
      }
      if (side === 'remote') void upload(source.paths)
      else void c.runPull(server.id, source.paths, local)
    } else if (side === 'remote') {
      try {
        const paths = files.map(f => window.desktop.pathForFile(f)).filter((p): p is string => !!p)
        if (paths.length) void upload(paths)
        else setMessage('无法读取拖入文件的本地路径')
      } catch (e) {
        setMessage(String(e))
      }
    }
  }
  const openSave = (kind: 'bookmark' | 'push' | 'pull') => {
    setDialog(kind)
    setName('')
    setMessage('')
  }
  const errorMessage =
    message || (c.statusText.bad ? c.statusText.text : c.pullStatusText.bad ? c.pullStatusText.text : '')
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold">工作台</h1>
          <p className="mt-1.5 text-[13px] text-mute">左侧本地，右侧服务器。选择文件后上传或拉取。</p>
        </div>
        <Btn onClick={onManage}>管理服务器</Btn>
      </div>
      <nav
        aria-label="位置书签"
        className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet/20 bg-violet/5 p-3 text-xs"
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
                  setMessage('这个书签的服务器已被删除')
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
              className="mr-1 rounded px-1.5 py-1 text-mute opacity-50 hover:bg-white/8 hover:text-fg hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
              onClick={() => persistBookmarks(bookmarks.filter(x => x.id !== b.id))}
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
        className="grid gap-3 md:grid-cols-[minmax(0,var(--left-pane))_8px_minmax(0,var(--right-pane))]"
        style={{ '--left-pane': `${split}fr`, '--right-pane': `${100 - split}fr` } as React.CSSProperties}
      >
        <div className="min-w-0">
          <FilePane
            title="本地"
            deletionBlocked={c.jobs.some(job => !job.done)}
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
          <div className="mt-3 flex items-center justify-between gap-2">
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
          className="hidden touch-none cursor-col-resize items-center justify-center rounded-md hover:bg-white/5 focus-visible:outline-cyan md:flex"
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
          <span className="h-12 w-0.5 rounded bg-white/15" />
        </div>
        <div className="min-w-0">
          <FilePane
            refreshToken={refreshTokens.remote}
            dragSource={dragging?.side ?? null}
            onDragFiles={setDragging}
            onDragFinish={() => setDragging(null)}
            onDropFiles={files => dropFiles('remote', files)}
            key={server?.id ?? 'empty'}
            title="服务器"
            serverLabel={server ? `${server.name} (${server.host})` : ''}
            deletionBlocked={c.jobs.some(job => !job.done)}
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
          <div className="mt-3 flex items-center justify-between gap-2">
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
      {!dialog && errorMessage && (
        <p role="alert" className="mt-2 text-xs text-err-text">
          {errorMessage}
        </p>
      )}
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
