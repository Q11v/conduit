import { useEffect, useState, type ReactNode } from 'react'
import { More, Pencil, Plus, Trash, Zap } from './Icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Btn, Chip, CountBadge, IconBtn, ProbeBadge } from './ui'
import { Hero } from './Hero'
import type { Check, Probe, Server } from '../types'

interface Props {
  loaded: boolean
  servers: Server[]
  tags: string[]
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

function ago(at: number, now: number) {
  const m = Math.floor((now - at) / 60_000)
  if (m < 1) return '刚刚检测'
  if (m < 60) return `${m} 分钟前检测`
  return `${hhmm(at)} 检测`
}

function ServerRow({
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
  const stale = !!verdict && now - verdict.at > STALE_MS
  const failed = !!verdict && !verdict.ok
  const sub = subline(s)

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t hair first:border-t-0 transition-colors duration-150 hover:bg-[rgba(255,255,255,.025)]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onEdit}
            title={`编辑 ${s.host}:${s.port ?? 22}`}
            className="min-w-0 p-0 border-0 bg-transparent text-left text-[14px] font-semibold text-fg truncate cursor-pointer hover:text-violet-text"
          >
            {s.name}
          </button>
          {s.auth === 'password' && (
            <span className="shrink-0 px-1.5 rounded border hair-3 text-[12px] leading-4 text-mute-2">密码</span>
          )}
          {s.tags?.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onTag(t)}
              title={`只看「${t}」`}
              className="shrink-0 px-1.5 border-0 rounded bg-[rgba(124,124,245,.12)] text-[12px] leading-[18px] text-violet-text cursor-pointer hover:bg-[rgba(124,124,245,.22)]"
            >
              #{t}
            </button>
          ))}
        </div>
        {(sub || failed) && (
          <div className="flex items-center gap-2 mt-0.5 min-w-0 text-[12px]">
            {sub && <span className="shrink-0 font-mono text-mute-4">{sub}</span>}
            {failed && (
              <span className="min-w-0 truncate text-err-text" title={verdict.reason}>
                {verdict.reason}
              </span>
            )}
          </div>
        )}
      </div>

      <ProbeBadge
        probe={probe}
        className={`w-14 transition-opacity ${stale ? 'opacity-50' : ''}`}
        title={verdict ? `${verdict.reason}${stale ? '\n已超过 10 分钟，建议重新检测' : ''}` : undefined}
      />
      <span
        className={`hidden sm:block w-24 shrink-0 text-right text-[12px] ${stale ? 'text-warn-text' : 'text-mute-4'}`}
      >
        {verdict && check !== 'testing' ? ago(verdict.at, now) : ''}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Btn
          onClick={onCheck}
          disabled={check === 'testing'}
          className="flex items-center gap-1 h-7 px-2.5 text-[12px] rounded-lg"
        >
          <Zap size={12} />
          检测
        </Btn>
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
        desc="主机和认证配一次，推送、拉取时直接选。目录在推送、拉取时按需填，常用的可以存下来。密码进钥匙串，配置只留在本机。"
        path={p.configPath}
        home={p.home}
      />

      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap mb-4">
        <h2 className="m-0 shrink-0 text-[17px] font-bold tracking-[-0.01em]">服务器</h2>
        {p.loaded ? <CountBadge n={count} /> : <span className="shrink-0 text-[13px] text-mute-2">载入中…</span>}
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
            目录在推送、拉取时再填。
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
          <div className="border hair-2 rounded-2xl panel overflow-hidden">
            {shown.map(s => (
              <ServerRow
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
