import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Chevron, Close, FileIcon, Folder } from './Icons'
import { Btn, Chip, CountBadge, IconBtn, PrimaryAction, ProbeBadge, StatusLine, StepLabel } from './ui'
import { Checkbox } from '@/components/ui/checkbox'
import { Hero } from './Hero'
import * as api from '../api'
import { formatSize, why } from '../api'
import type { Listing, Probe, Server } from '../types'
import type { Status } from '../useConduit'

interface Group {
  name: string
  label: string
  servers: Server[]
}

interface Props {
  loaded: boolean
  groups: Group[]
  server: Server | null
  probeOf: (serverId: string) => Probe
  onServer: (id: string) => void
  paths: string[]
  onTogglePath: (path: string) => void
  localDir: string
  onLocalDir: (v: string) => void
  status: Status
  ready: boolean
  busy: boolean
  onPull: () => void
  onSave: () => void
  onGoServers: () => void
  presetsPath: string
  home: string
}

const joinPath = (dir: string, name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`)
const parentOf = (dir: string) => dir.replace(/\/[^/]+\/?$/, '') || '/'
const baseOf = (path: string) => path.replace(/\/+$/, '').split('/').pop() || '/'
const LOCAL_DIRS = ['Downloads', 'Desktop']

function useBrowser(server: Server | null) {
  const [input, setInput] = useState('')
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kinds, setKinds] = useState<Record<string, 'dir' | 'file'>>({})
  const seq = useRef(0)

  const open = useCallback(
    async (path: string) => {
      if (!server) return null
      const n = ++seq.current
      setInput(path)
      setLoading(true)
      const r = await api.browse(server.id, path)
      if (n !== seq.current) return null
      setLoading(false)
      if (!r.ok || !r.path) {
        setError(why(r))
        return null
      }
      setError(null)
      const l = r as Listing
      setListing(l)
      setInput(l.path)
      setKinds(k => {
        const next: Record<string, 'dir' | 'file'> = { ...k, [l.path]: 'dir' }
        for (const e of l.entries) next[joinPath(l.path, e.name)] = e.type
        return next
      })
      return r as Listing
    },
    [server]
  )

  useEffect(() => {
    setListing(null)
    setError(null)
    if (server) void open(server.dirs[0] ?? '~')
  }, [server?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { input, setInput, listing, loading, error, open, kinds }
}

export function PullView(p: Props) {
  const b = useBrowser(p.server)
  const [editing, setEditing] = useState(false)
  const live = p.ready && !p.busy
  const cwd = b.listing?.path ?? null

  const go = async (path: string) => {
    const r = await b.open(path.trim() || '~')
    if (r?.select && !p.paths.includes(r.select)) p.onTogglePath(r.select)
  }

  const header = (
    <Hero
      eyebrow="remote to local"
      title="从服务器拉回本机"
      desc="浏览远端目录，勾好文件或目录，一次拉到本地。和推送走同一条 SSH + rsync。"
      path={p.presetsPath}
      home={p.home}
    />
  )

  if (!p.loaded) {
    return (
      <div>
        {header}
        <div className="px-5 py-10 border border-dashed border-[rgba(255,255,255,.08)] rounded-2xl text-center text-[13px] text-mute-4">
          载入中…
        </div>
      </div>
    )
  }

  if (!p.server) {
    return (
      <div>
        {header}
        <div className="px-5 py-10 border border-dashed border-[rgba(255,255,255,.14)] rounded-2xl text-center">
          <p className="m-0 mb-2 text-[13px] text-fg-dim">还没有配置服务器</p>
          <button
            onClick={p.onGoServers}
            className="p-0 border-0 bg-transparent text-link text-[13px] cursor-pointer hover:underline"
          >
            去「服务器」页添加一台 →
          </button>
        </div>
      </div>
    )
  }

  const cwdSelected = cwd !== null && p.paths.includes(cwd)
  const entries = b.listing?.entries ?? []
  const entryPaths = entries.map(e => joinPath(b.listing!.path, e.name))
  const pickedHere = entryPaths.filter(path => p.paths.includes(path)).length
  const allState = entries.length > 0 && pickedHere === entries.length ? true : pickedHere > 0 ? 'indeterminate' : false
  const toggleAll = () =>
    entryPaths.forEach(path => {
      if (allState === true || !p.paths.includes(path)) p.onTogglePath(path)
    })
  const dest = p.localDir.trim().replace(/(.)\/+$/, '$1')
  const crumbs = cwd
    ? cwd
        .split('/')
        .filter(Boolean)
        .map((seg, i, all) => ({ seg, path: `/${all.slice(0, i + 1).join('/')}` }))
    : []

  return (
    <div>
      {header}

      <section className="flex flex-wrap items-end gap-x-3 gap-y-3 p-4 mb-3 border hair-2 rounded-2xl panel">
        <div className="flex-1 min-w-[16rem]">
          <StepLabel step="01" title="源服务器" />
          <span className="relative flex items-center">
            <select
              value={p.server.id}
              onChange={e => p.onServer(e.target.value)}
              title={`${p.server.host}${p.server.port ? `:${p.server.port}` : ''}`}
              className="flex-1 min-w-0 h-9 pl-[11px] pr-24 rounded-[9px] border field-edge sunken text-fg font-mono text-[13px] outline-0 focus:border-[rgba(124,124,245,.7)]"
            >
              {p.groups.map(g => (
                <optgroup key={g.name} label={g.label}>
                  {g.servers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ProbeBadge probe={p.probeOf(p.server.id)} className="pointer-events-none absolute right-8" />
          </span>
        </div>

        <span className="hidden sm:flex items-center h-9 text-mute-4">→</span>

        <div className="flex-1 min-w-[16rem]">
          <StepLabel step="02" title="本地目录" />
          <span className="flex items-center gap-2">
            <input
              value={p.localDir}
              onChange={e => p.onLocalDir(e.target.value)}
              spellCheck={false}
              placeholder="~/Downloads"
              className="flex-1 min-w-0 h-9 px-[11px] rounded-[9px] border field-edge sunken font-mono text-[13px] text-fg outline-0 focus:border-[rgba(124,124,245,.7)]"
            />
            {LOCAL_DIRS.map(d => (
              <Chip key={d} size="md" active={dest === `~/${d}`} onClick={() => p.onLocalDir(`~/${d}`)}>
                {d}
              </Chip>
            ))}
          </span>
        </div>
      </section>

      <div className="grid gap-3 mb-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex flex-col min-w-0 border hair-2 rounded-2xl panel overflow-hidden lg:h-[540px]">
          <form
            onSubmit={e => {
              e.preventDefault()
              setEditing(false)
              void go(b.input)
            }}
            className="p-3 border-b hair"
          >
            <StepLabel step="03" title="远端路径" hint="勾选要拉的文件或目录" />
            <div className="flex flex-1 min-w-0 items-center h-9 rounded-[9px] border field-edge sunken focus-within:border-[rgba(124,124,245,.7)]">
              <IconBtn
                type="button"
                onClick={() => cwd && void b.open(parentOf(cwd))}
                disabled={!cwd || cwd === '/'}
                className="w-8 h-full rounded-l-[8px] rounded-r-none border-r hair-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="上一级"
              >
                <ArrowUp size={14} />
              </IconBtn>
              {editing || !cwd ? (
                <input
                  autoFocus={editing}
                  value={b.input}
                  onChange={e => b.setInput(e.target.value)}
                  onBlur={() => setEditing(false)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      b.setInput(cwd ?? '')
                      setEditing(false)
                    }
                  }}
                  spellCheck={false}
                  placeholder="/var/log 或 ~/backups，回车打开"
                  className="flex-1 min-w-0 h-full px-[11px] border-0 bg-transparent font-mono text-[13px] text-fg outline-0"
                />
              ) : (
                <div
                  onClick={() => setEditing(true)}
                  title="点空白处可输入或粘贴路径"
                  className="flex flex-1 min-w-0 items-center h-full px-1.5 overflow-x-auto font-mono text-[13px] cursor-text"
                >
                  <CrumbBtn onClick={() => void b.open('/')}>/</CrumbBtn>
                  {crumbs.map((c, i) => (
                    <span key={c.path} className="flex shrink-0 items-center">
                      {i > 0 && <span className="text-mute-5">/</span>}
                      <CrumbBtn current={i === crumbs.length - 1} onClick={() => void b.open(c.path)}>
                        {c.seg}
                      </CrumbBtn>
                    </span>
                  ))}
                </div>
              )}
              {b.loading && <span className="shrink-0 pr-2.5 text-[12px] text-warn-text">读取中…</span>}
            </div>
          </form>

          <div className="flex items-center gap-1.5 px-3 py-2 border-b hair overflow-x-auto">
            <span className="shrink-0 mr-0.5 text-[12px] text-mute-4">快捷</span>
            {['~', ...p.server.dirs].map(d => (
              <Chip key={d} active={d === cwd} onClick={() => void b.open(d)}>
                {d}
              </Chip>
            ))}
          </div>

          <div className="flex items-center gap-2.5 px-4 h-9 border-b hair text-[12px] text-mute-3">
            <Checkbox
              checked={allState}
              onCheckedChange={toggleAll}
              disabled={entries.length === 0}
              aria-label="全选本目录下的条目"
            />
            <span className="flex-1 min-w-0 truncate">
              名称 · {entries.length} 项{pickedHere ? `，已选 ${pickedHere}` : ''}
            </span>
            {cwd && (
              <Chip
                active={cwdSelected}
                onClick={() => p.onTogglePath(cwd)}
                title="把当前目录本身作为一项拉取（包含之后新增的文件）"
              >
                {cwdSelected ? '✓ ' : ''}拉整个 {baseOf(cwd)}/
              </Chip>
            )}
          </div>

          {b.error && (
            <div className="px-4 py-2 border-b hair text-[12px] leading-snug text-err-text break-words">{b.error}</div>
          )}

          <div className="flex-1 min-h-0 max-h-[360px] lg:max-h-none overflow-auto">
            {!b.listing && b.loading && <div className="px-3 py-6 text-center text-[12px] text-mute-4">读取中…</div>}
            {b.listing && entries.length === 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-mute-4">空目录</div>
            )}
            {entries.map((e, i) => {
              const path = entryPaths[i]
              const checked = p.paths.includes(path)
              const isDir = e.type === 'dir'
              return (
                <div
                  key={e.name}
                  className={`group flex items-center gap-2.5 px-4 h-9 border-b border-[rgba(255,255,255,.04)] transition-colors duration-150 ${
                    checked ? 'bg-[rgba(124,124,245,.1)]' : 'hover:bg-[rgba(255,255,255,.035)]'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => p.onTogglePath(path)}
                    aria-label={`选择 ${e.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => (isDir ? void b.open(path) : p.onTogglePath(path))}
                    title={path}
                    className="flex flex-1 min-w-0 items-center gap-2 h-full p-0 border-0 bg-transparent text-left cursor-pointer"
                  >
                    {isDir ? (
                      <Folder className="shrink-0 text-violet-text" />
                    ) : (
                      <FileIcon size={14} className="shrink-0 text-mute-3" />
                    )}
                    <span className={`min-w-0 font-mono text-[12px] truncate ${isDir ? 'text-fg' : 'text-fg-dim'}`}>
                      {e.name}
                      {isDir ? '/' : ''}
                    </span>
                  </button>
                  {e.size != null && (
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-mute-4">
                      {formatSize(e.size)}
                    </span>
                  )}
                  {isDir && (
                    <IconBtn onClick={() => void b.open(path)} className="w-6 h-6" title="进入">
                      <Chevron size={12} />
                    </IconBtn>
                  )}
                </div>
              )
            })}
            {b.listing?.truncated && (
              <div className="px-4 py-2 text-[12px] text-mute-3">
                条目太多，只列了前 {entries.length} 项 —— 其余的请直接在路径栏填
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t hair text-[12px] text-mute-4">
            勾选框选中 · 点目录名或 › 进入 · 点路径栏空白处可粘贴路径
          </div>
        </section>

        <aside className="flex flex-col min-w-0 border hair-2 rounded-2xl panel overflow-hidden lg:h-[540px]">
          <div className="px-4 pt-3 pb-1 border-b hair">
            <StepLabel
              title="待拉取"
              count={<CountBadge n={p.paths.length} />}
              aside={
                p.paths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => p.paths.forEach(path => p.onTogglePath(path))}
                    className="p-0 border-0 bg-transparent text-[12px] text-mute-3 cursor-pointer hover:text-err-text"
                  >
                    清空
                  </button>
                )
              }
            />
          </div>

          <div className="flex-1 min-h-0 max-h-[320px] lg:max-h-none overflow-auto">
            {p.paths.length === 0 && (
              <div className="px-4 py-10 text-center text-[12px] leading-relaxed text-mute-4">
                还没有选中项
                <br />
                在左侧勾选文件或目录
              </div>
            )}
            {p.paths.map(path => {
              const isDir = b.kinds[path] === 'dir'
              const name = baseOf(path)
              return (
                <div
                  key={path}
                  className="group flex items-start gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,.04)]"
                >
                  {isDir ? (
                    <Folder className="shrink-0 mt-[2px] text-violet-text" />
                  ) : (
                    <FileIcon size={14} className="shrink-0 mt-[2px] text-mute-3" />
                  )}
                  <div className="flex-1 min-w-0 font-mono text-[12px]" title={path}>
                    <div className="truncate text-fg">
                      {name}
                      {isDir ? '/' : ''}
                    </div>
                    <div className="truncate text-mute-4">
                      → {dest || '（未填本地目录）'}/{name}
                      {isDir ? '/' : ''}
                    </div>
                  </div>
                  <IconBtn
                    onClick={() => p.onTogglePath(path)}
                    className="w-5 h-5 mt-[1px] rounded"
                    title="移出本次拉取"
                  >
                    <Close size={10} />
                  </IconBtn>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 p-4 border-t hair bg-[rgba(255,255,255,.02)]">
            <StatusLine status={p.status} className="min-h-[18px] break-words" />
            <div className="flex gap-2">
              <Btn onClick={p.onSave} className="flex-1 py-2 text-[13px] font-medium rounded-[10px]">
                存为方案
              </Btn>
              <PrimaryAction live={live} onClick={p.onPull} className="flex-[1.4] px-4">
                <ArrowDown />
                {p.busy ? '拉取中…' : p.paths.length ? `拉取 ${p.paths.length} 项` : '拉取'}
              </PrimaryAction>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CrumbBtn({ current, onClick, children }: { current?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      className={`shrink-0 px-1 py-[1px] border-0 rounded bg-transparent font-mono text-[13px] cursor-pointer hover:bg-[rgba(255,255,255,.08)] ${
        current ? 'text-fg' : 'text-mute-3 hover:text-fg-dim'
      }`}
    >
      {children}
    </button>
  )
}
