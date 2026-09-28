import { useEffect, useState, type ReactNode } from 'react'
import { More, Pencil, Plus, Trash, Zap } from './Icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Btn, Chip, CountBadge, IconBtn, ProbeBadge } from './ui'
import { Hero } from './Hero'
import type { Check, DirVerdict, Probe, Server } from '../types'

interface Props {
  loaded: boolean
  servers: Server[]
  tags: string[]
  totalTargets: number
  checks: Record<string, Check>
  probeOf: (serverId: string) => Probe
  configPath: string
  home: string
  onCheck: (id: string) => void
  onCheckAll: () => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onNew: () => void
}

const STALE_MS = 10 * 60 * 1000

function subline(s: Server) {
  const port = s.port && s.port !== 22 ? s.port : null
  if (s.name !== s.host) return port ? `${s.host}:${port}` : s.host
  return port ? `端口 ${port}` : ''
}

const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

function dirDot(dv?: DirVerdict) {
  if (!dv) return 'var(--color-mute-4)'
  if (!dv.ok) return 'var(--color-err)'
  return dv.state === 'writable' ? 'var(--color-ok)' : 'var(--color-mute-2)'
}

const DIR_STATE: Record<string, string> = {
  writable: '可写',
  readonly: '只读',
  missing: '不存在',
  unknown: '未知'
}

function ago(at: number, now: number) {
  const m = Math.floor((now - at) / 60_000)
  if (m < 1) return '刚刚检测'
  if (m < 60) return `${m} 分钟前检测`
  return `${hhmm(at)} 检测`
}

function ServerCard({
  s,
  check,
  probe,
  now,
  onCheck,
  onEdit,
  onRemove,
  onTag
}: {
  s: Server
  check?: Check
  probe: Probe
  now: number
  onCheck: () => void
  onEdit: () => void
  onRemove: () => void
  onTag: (tag: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const verdict = check && check !== 'testing' ? check : null
  const connLevel =
    !!verdict && !verdict.ok && (verdict.dirs.length === 0 || verdict.dirs.every(d => d.reason === verdict.reason))
  const stale = !!verdict && now - verdict.at > STALE_MS
  const sub = subline(s)

  return (
    <div className="flex flex-col min-w-0 border hair-2 rounded-2xl panel transition-colors duration-150 hover:border-[rgba(255,255,255,.16)]">
      <div className="px-4 pt-3.5">
        <div className="flex items-center gap-2 min-h-7">
          <span className="min-w-0 text-[14px] font-semibold truncate" title={`${s.host}:${s.port ?? 22}`}>
            {s.name}
          </span>
          {s.auth === 'password' && (
            <span className="shrink-0 px-1.5 rounded border hair-3 text-[12px] leading-4 text-mute-2">密码</span>
          )}
          <ProbeBadge
            probe={probe}
            className={`transition-opacity ${stale ? 'opacity-50' : ''}`}
            title={verdict ? `${verdict.reason}${stale ? '\n已超过 10 分钟，建议重新检测' : ''}` : undefined}
          />
          <span className="flex-1" />
          <Popover open={menu} onOpenChange={setMenu}>
            <PopoverTrigger asChild>
              <IconBtn className="w-7 h-7" title="更多" aria-label={`${s.name} 的更多操作`}>
                <More />
              </IconBtn>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-36 p-1">
              <MenuItem
                onClick={() => {
                  setMenu(false)
                  onEdit()
                }}
              >
                <Pencil />
                编辑
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  setMenu(false)
                  onRemove()
                }}
              >
                <Trash />
                删除
              </MenuItem>
            </PopoverContent>
          </Popover>
        </div>
        {(sub || s.tags?.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {sub && <span className="font-mono text-[12px] text-mute-4">{sub}</span>}
            {s.tags?.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => onTag(t)}
                title={`只看「${t}」`}
                className="px-1.5 border-0 rounded bg-[rgba(124,124,245,.12)] text-[12px] leading-[18px] text-violet-text cursor-pointer hover:bg-[rgba(124,124,245,.22)]"
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-3">
        {connLevel && (
          <div className="mb-2 px-2.5 py-2 rounded-lg bg-[rgba(226,86,86,.1)] text-[12px] leading-snug break-words text-err-text">
            {verdict.reason}
          </div>
        )}
        <div className="flex flex-col">
          {s.dirs.map(dir => {
            const dv = connLevel ? undefined : verdict?.dirs.find(x => x.dir === dir)
            const label = dv ? (dv.state ? DIR_STATE[dv.state] : dv.reason) : ''
            return (
              <div key={dir} className="flex items-center gap-2.5 min-w-0 h-7" title={dv?.reason}>
                <span
                  className="shrink-0 w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ background: dirDot(dv) }}
                />
                <span className="flex-1 min-w-0 font-mono text-[12.5px] text-fg-dim truncate">{dir}</span>
                {label && (
                  <span
                    className="shrink-0 text-[12px]"
                    style={{ color: dv && !dv.ok ? 'var(--color-err-text)' : 'var(--color-mute-3)' }}
                  >
                    {label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-t hair">
        <span className={`flex-1 min-w-0 truncate text-[12px] ${stale ? 'text-warn-text' : 'text-mute-4'}`}>
          {check === 'testing' ? '检测中…' : verdict ? ago(verdict.at, now) : '还没检测过'}
        </span>
        <Btn
          onClick={onCheck}
          disabled={check === 'testing'}
          className="flex items-center gap-1 h-7 px-2.5 text-[12px] rounded-lg"
        >
          <Zap size={12} />
          检测
        </Btn>
      </div>
    </div>
  )
}

function MenuItem({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2.5 py-1.5 border-0 rounded-lg bg-transparent text-left text-[13px] cursor-pointer ${
        danger ? 'text-err-text hover:bg-[rgba(226,86,86,.14)]' : 'text-fg-soft hover:bg-[rgba(255,255,255,.08)]'
      }`}
    >
      {children}
    </button>
  )
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function ServersView(p: Props) {
  const count = p.servers.length
  const now = useNow()
  const [tag, setTag] = useState<string | null>(null)
  const active = tag && p.tags.includes(tag) ? tag : null
  const shown = active ? p.servers.filter(s => s.tags?.includes(active)) : p.servers

  return (
    <div>
      <Hero
        eyebrow="ssh targets"
        title="一处配置，推拉共用"
        desc="主机和常用目录配一次，推送、拉取时直接勾选。密码进钥匙串，配置只留在本机。"
        path={p.configPath}
        home={p.home}
      />

      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap mb-4">
        <h2 className="m-0 shrink-0 text-[17px] font-bold tracking-[-0.01em]">服务器</h2>
        {p.loaded ? (
          <>
            <CountBadge n={count} />
            <span className="shrink-0 whitespace-nowrap text-[13px] text-mute-2">共 {p.totalTargets} 个常用目录</span>
          </>
        ) : (
          <span className="shrink-0 text-[13px] text-mute-2">载入中…</span>
        )}
        <div className="flex-1" />
        <Btn onClick={p.onCheckAll} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-[10px]">
          <Zap />
          全部检测
        </Btn>
        <Btn
          variant="primary"
          onClick={p.onNew}
          className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-[10px]"
        >
          <Plus size={14} />
          新增服务器
        </Btn>
      </div>

      {!p.loaded ? (
        <div className="px-5 py-10 border border-dashed border-[rgba(255,255,255,.08)] rounded-2xl text-center text-[13px] text-mute-4">
          载入中…
        </div>
      ) : count === 0 ? (
        <div className="px-5 py-10 border border-dashed border-[rgba(255,255,255,.14)] rounded-2xl text-center">
          <p className="m-0 mb-2 text-[13px] text-fg-dim">还没有配置服务器</p>
          <p className="m-0 text-[13px] leading-relaxed text-mute-2">
            点右上角「新增服务器」填一台。主机可以用 ~/.ssh/config 里的别名，
            <br />
            一台机器可以配多个常用目录，推送时逐条勾选。
          </p>
        </div>
      ) : (
        <>
          {p.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <Chip active={!active} onClick={() => setTag(null)}>
                全部 {count}
              </Chip>
              {p.tags.map(t => (
                <Chip key={t} active={active === t} onClick={() => setTag(active === t ? null : t)}>
                  #{t} {p.servers.filter(s => s.tags?.includes(t)).length}
                </Chip>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map(s => (
              <ServerCard
                key={s.id}
                s={s}
                check={p.checks[s.id]}
                probe={p.probeOf(s.id)}
                now={now}
                onCheck={() => p.onCheck(s.id)}
                onEdit={() => p.onEdit(s.id)}
                onRemove={() => p.onRemove(s.id)}
                onTag={setTag}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
