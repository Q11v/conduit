import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Close, FileIcon, Folder } from './Icons'
import { Btn, IconBtn, SectionHeader } from './ui'
import { Checkbox } from '@/components/ui/checkbox'
import { Hero } from './Hero'
import * as api from '../api'
import { formatSize, why } from '../api'
import { PROBE } from '../probe'
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

function useBrowser(server: Server | null) {
  const [input, setInput] = useState('')
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setListing(r as Listing)
      setInput(r.path)
      return r as Listing
    },
    [server]
  )

  useEffect(() => {
    setListing(null)
    setError(null)
    if (server) void open(server.dirs[0] ?? '~')
  }, [server?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { input, setInput, listing, loading, error, open }
}

export function PullView(p: Props) {
  const b = useBrowser(p.server)
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

  const pr = PROBE[p.probeOf(p.server.id)]
  const cwdSelected = cwd !== null && p.paths.includes(cwd)

  return (
    <div>
      {header}

      <section className="border hair-2 rounded-2xl panel mb-7">
        <div className="p-[18px]">
          <SectionHeader step="01" title="源服务器" hint="一次从一台机器拉" />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={p.server.id}
              onChange={e => p.onServer(e.target.value)}
              className="min-w-[14rem] h-9 px-[11px] rounded-[9px] border field-edge sunken text-fg text-[13px] outline-0 focus:border-[rgba(124,124,245,.7)]"
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
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: pr.fg }}>
              <span className={`w-1.5 h-1.5 rounded-full ${pr.anim}`} style={{ background: pr.dot }} />
              {pr.label}
            </span>
            <span className="min-w-0 font-mono text-[12px] text-mute-3 truncate">
              {p.server.host}
              {p.server.port ? `:${p.server.port}` : ''}
            </span>
          </div>
        </div>

        <div className="px-[18px] py-[18px] border-t hair">
          <SectionHeader
            step="02"
            title="远端路径"
            hint="点目录名进入，勾选框选中；也可以直接粘贴路径回车"
            aside={<>已选 {p.paths.length} 项</>}
          />

          <form
            onSubmit={e => {
              e.preventDefault()
              void go(b.input)
            }}
            className="flex items-center gap-1.5 mb-2"
          >
            <IconBtn
              type="button"
              onClick={() => cwd && void b.open(parentOf(cwd))}
              disabled={!cwd || cwd === '/'}
              className="w-9 h-9 border hair-3 rounded-[9px] disabled:opacity-40 disabled:cursor-not-allowed"
              title="上一级"
            >
              <ArrowUp size={14} />
            </IconBtn>
            <input
              value={b.input}
              onChange={e => b.setInput(e.target.value)}
              spellCheck={false}
              placeholder="/var/log 或 ~/backups"
              className="flex-1 min-w-0 h-9 px-[11px] rounded-[9px] border field-edge sunken font-mono text-[13px] text-fg outline-0 focus:border-[rgba(124,124,245,.7)]"
            />
            <Btn type="submit" className="px-3.5 h-9 text-[13px]">
              打开
            </Btn>
          </form>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {['~', ...p.server.dirs].map(d => (
              <button
                key={d}
                onClick={() => void b.open(d)}
                className="px-2 py-[3px] border hair-2 rounded-md bg-[rgba(255,255,255,.03)] font-mono text-[12px] text-mute-2 cursor-pointer hover:text-fg-dim hover:border-[rgba(255,255,255,.2)]"
              >
                {d}
              </button>
            ))}
          </div>

          <div className="border hair-2 rounded-xl bg-[rgba(0,0,0,.3)] overflow-hidden">
            {cwd && (
              <div className="flex items-center gap-2 px-3 py-2 border-b hair">
                <span className="flex-1 min-w-0 font-mono text-[12px] text-mute-3 truncate" title={cwd}>
                  {cwd}
                </span>
                {b.loading && <span className="shrink-0 text-[12px] text-warn-text">读取中…</span>}
                <button
                  onClick={() => p.onTogglePath(cwd)}
                  className="shrink-0 p-0 border-0 bg-transparent text-link text-[12px] cursor-pointer hover:underline"
                >
                  {cwdSelected ? '取消选择整个目录' : '选择整个目录'}
                </button>
              </div>
            )}

            {b.error && (
              <div className="px-3 py-2 border-b hair text-[12px] leading-snug text-err-text break-words">
                {b.error}
              </div>
            )}

            <div className="max-h-[320px] overflow-auto">
              {!b.listing && b.loading && <div className="px-3 py-6 text-center text-[12px] text-mute-4">读取中…</div>}
              {b.listing && b.listing.entries.length === 0 && (
                <div className="px-3 py-6 text-center text-[12px] text-mute-4">空目录</div>
              )}
              {b.listing?.entries.map(e => {
                const path = joinPath(b.listing!.path, e.name)
                const checked = p.paths.includes(path)
                const isDir = e.type === 'dir'
                return (
                  <div
                    key={e.name}
                    className={`flex items-center gap-2.5 px-3 py-1.5 transition-colors duration-150 ${
                      checked ? 'bg-[rgba(124,124,245,.12)]' : 'hover:bg-[rgba(255,255,255,.04)]'
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
                      className="flex flex-1 min-w-0 items-center gap-2 p-0 border-0 bg-transparent text-left cursor-pointer"
                    >
                      {isDir ? (
                        <Folder className="shrink-0 text-violet-text" />
                      ) : (
                        <FileIcon size={14} className="shrink-0 text-mute-3" />
                      )}
                      <span className={`min-w-0 font-mono text-[12px] break-all ${isDir ? 'text-fg' : 'text-fg-dim'}`}>
                        {e.name}
                        {isDir ? '/' : ''}
                      </span>
                    </button>
                    {e.size != null && (
                      <span className="shrink-0 font-mono text-[12px] text-mute-4">{formatSize(e.size)}</span>
                    )}
                  </div>
                )
              })}
              {b.listing?.truncated && (
                <div className="px-3 py-2 border-t hair text-[12px] text-mute-3">
                  条目太多，只列了前 {b.listing.entries.length} 项 —— 其余的请直接在上面填路径
                </div>
              )}
            </div>
          </div>

          {p.paths.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {p.paths.map(path => (
                <span
                  key={path}
                  className="flex min-w-0 max-w-full items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-[rgba(255,255,255,.06)]"
                >
                  <span className="min-w-0 font-mono text-[12px] text-fg-dim break-all">{path}</span>
                  <IconBtn
                    onClick={() => p.onTogglePath(path)}
                    className="w-[16px] h-[16px] rounded"
                    title="移出本次拉取"
                  >
                    <Close size={10} />
                  </IconBtn>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-[18px] py-[18px] border-t hair">
          <SectionHeader step="03" title="本地目录" hint="每项落地为「本地目录/同名」，已有的同名文件会被覆盖" />
          <input
            value={p.localDir}
            onChange={e => p.onLocalDir(e.target.value)}
            spellCheck={false}
            placeholder="~/Downloads"
            className="w-full h-9 px-[11px] rounded-[9px] border field-edge sunken font-mono text-[13px] text-fg outline-0 focus:border-[rgba(124,124,245,.7)]"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap px-[18px] py-3 border-t hair bg-[rgba(255,255,255,.02)] rounded-b-2xl">
          <div
            className="flex-1 min-w-[6rem] text-[13px] truncate"
            style={{ color: p.status.bad ? 'var(--color-err-text)' : 'var(--color-mute-2)' }}
          >
            {p.status.text}
          </div>

          <Btn onClick={p.onSave} className="px-3.5 py-2 text-[13px] font-medium rounded-[10px]">
            存为方案
          </Btn>

          <button
            onClick={p.onPull}
            disabled={!live}
            className="flex shrink-0 items-center gap-2 px-5 py-2 border-0 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-[filter] duration-150 enabled:hover:brightness-90"
            style={{
              background: live
                ? 'linear-gradient(150deg,var(--color-violet-btn),var(--color-violet-lo))'
                : 'rgba(255,255,255,.07)',
              color: live ? '#fff' : 'var(--color-mute-4)',
              cursor: live ? 'pointer' : 'default',
              boxShadow: live ? '0 4px 20px rgba(124,105,245,.36)' : 'none'
            }}
          >
            <ArrowDown />
            {p.busy ? '拉取中…' : p.paths.length ? `拉取 ${p.paths.length} 项` : '拉取'}
          </button>
        </div>
      </section>
    </div>
  )
}
