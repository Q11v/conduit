import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash, Zap } from './Icons'
import { Btn, IconBtn } from './ui'
import { Hero } from './Hero'
import { PROBE } from '../probe'
import type { Check, DirVerdict, Probe, Server } from '../types'

interface Group {
  name: string
  label: string
  servers: Server[]
}

interface Props {
  loaded: boolean
  groups: Group[]
  totalTargets: number
  checks: Record<string, Check>
  probeOf: (serverId: string) => Probe
  configPath: string
  home: string
  onCheck: (id: string) => void
  onCheckAll: () => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onRenameGroup: (from: string, to: string) => Promise<string | null>
  onUngroup: (name: string) => void
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

const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s)

function ServerRow({
  s,
  check,
  probe,
  now,
  onCheck,
  onEdit,
  onRemove
}: {
  s: Server
  check?: Check
  probe: Probe
  now: number
  onCheck: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const p = PROBE[probe]
  const verdict = check && check !== 'testing' ? check : null
  const connLevel =
    !!verdict && !verdict.ok && (verdict.dirs.length === 0 || verdict.dirs.every(d => d.reason === verdict.reason))
  const stale = !!verdict && now - verdict.at > STALE_MS
  const sub = subline(s)
  const notes = verdict && !connLevel ? verdict.dirs.filter(d => s.dirs.includes(d.dir) && d.state !== 'writable') : []

  return (
    <div className="mb-1.5 border border-[rgba(255,255,255,.08)] rounded-xl bg-[rgba(255,255,255,.03)]">
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="min-w-0 text-[13px] font-medium truncate" title={`${s.host}:${s.port ?? 22}`}>
              {s.name}
            </span>
            {s.auth === 'password' && (
              <span className="shrink-0 px-1.5 rounded border hair-3 text-[12px] leading-4 text-mute-2">密码</span>
            )}
            <span
              className={`flex shrink-0 items-center gap-[5px] whitespace-nowrap text-[12px] transition-opacity ${
                stale ? 'opacity-50' : ''
              }`}
              style={{ color: p.fg }}
              title={
                verdict
                  ? `${verdict.reason}\n${hhmm(verdict.at)} 检测${stale ? '，已超过 10 分钟，建议重新检测' : ''}`
                  : undefined
              }
            >
              <span className={`w-[5px] h-[5px] rounded-full ${p.anim}`} style={{ background: p.dot }} />
              {p.label}
            </span>
          </div>
          {sub && <div className="mt-0.5 font-mono text-[12px] text-mute-3 truncate">{sub}</div>}
          {connLevel && <div className="mt-1 text-[12px] leading-snug break-words text-err-text">{verdict.reason}</div>}
        </div>

        <IconBtn
          onClick={onCheck}
          disabled={check === 'testing'}
          className="h-[26px] px-2 text-[12px] disabled:opacity-45 disabled:cursor-not-allowed"
        >
          检测
        </IconBtn>
        <IconBtn onClick={onEdit} className="w-[26px] h-[26px]" title="编辑">
          <Pencil />
        </IconBtn>
        <IconBtn onClick={onRemove} danger className="w-[26px] h-[26px]" title="删除">
          <Trash />
        </IconBtn>
      </div>

      <div className="px-3.5 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {s.dirs.map(dir => {
            const dv = connLevel ? undefined : verdict?.dirs.find(x => x.dir === dir)
            return (
              <span
                key={dir}
                title={dv?.reason}
                className="flex min-w-0 max-w-full items-center gap-1.5 px-2 py-[3px] rounded-md border hair-2 bg-[rgba(255,255,255,.03)] font-mono text-[12px] text-fg-dim"
              >
                <span
                  className="shrink-0 w-[5px] h-[5px] rounded-full transition-colors"
                  style={{ background: dirDot(dv) }}
                />
                <span className="min-w-0 break-all">{dir}</span>
              </span>
            )
          })}
        </div>
        {notes.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5">
            {notes.map(d => (
              <div
                key={d.dir}
                className="text-[12px] leading-snug break-words"
                style={{ color: d.ok ? 'var(--color-mute-2)' : 'var(--color-err-text)' }}
              >
                <span className="font-mono">{d.dir}</span> {d.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GroupHeader({
  g,
  others,
  onRename,
  onUngroup
}: {
  g: Group
  others: string[]
  onRename: (to: string) => Promise<string | null>
  onUngroup: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cancelled = useRef(false)

  const start = () => {
    cancelled.current = false
    setDraft(g.name)
    setErr(null)
    setEditing(true)
  }
  const save = async () => {
    const to = draft.trim()
    if (!to || to === g.name) {
      setEditing(false)
      return
    }
    setBusy(true)
    const e = await onRename(to)
    setBusy(false)
    if (e) setErr(e)
    else setEditing(false)
  }

  const merging = editing && draft.trim() !== g.name && others.includes(draft.trim())

  return (
    <div className="group px-1 pb-2">
      <div className="flex items-center gap-[9px] min-h-7">
        {editing ? (
          <input
            autoFocus
            aria-label={`分组「${g.name}」的新名字`}
            value={draft}
            disabled={busy}
            onChange={e => {
              setDraft(e.target.value)
              setErr(null)
            }}
            onFocus={e => e.currentTarget.select()}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
              if (e.key === 'Escape') {
                cancelled.current = true
                setEditing(false)
              }
            }}
            onBlur={() => {
              if (!busy && !cancelled.current) void save()
            }}
            className="h-7 w-44 px-2.5 rounded-md border field-edge sunken text-[12px] text-fg outline-0 focus:border-[rgba(124,124,245,.7)]"
          />
        ) : (
          <span
            className={`shrink-0 text-mute-4 ${
              isAscii(g.label) ? 'font-mono text-[12px] uppercase tracking-[.14em]' : 'text-[12px] font-medium'
            }`}
          >
            {g.label}
          </span>
        )}
        {!editing && (
          <span className="shrink-0 px-1.5 rounded-full bg-[rgba(255,255,255,.06)] text-[12px] leading-5 text-mute-3">
            {g.servers.length}
          </span>
        )}
        {merging && <span className="shrink-0 text-[12px] text-warn-text">会并入已有分组</span>}
        <div className="flex-1 h-px bg-[rgba(255,255,255,.07)]" />
        {g.name && !editing && (
          <div className="flex items-center gap-[9px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <IconBtn onClick={start} className="w-[26px] h-[26px]" title="改名" aria-label={`给分组「${g.name}」改名`}>
              <Pencil size={12} />
            </IconBtn>
            <IconBtn
              onClick={onUngroup}
              danger
              className="w-[26px] h-[26px]"
              title="解散分组"
              aria-label={`解散分组「${g.name}」`}
            >
              <Trash size={12} />
            </IconBtn>
          </div>
        )}
      </div>
      {err && <div className="mt-1 text-[12px] text-err-text">{err}</div>}
    </div>
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
  const count = p.groups.reduce((n, g) => n + g.servers.length, 0)
  const now = useNow()

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
        <h2 className="m-0 shrink-0 text-[17px] font-bold tracking-[-0.01em]">服务器列表</h2>
        <span className="shrink-0 whitespace-nowrap text-[13px] text-mute-2">
          {p.loaded ? `${count} 台 · ${p.totalTargets} 个目录` : '载入中…'}
        </span>
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
        p.groups.map(g => (
          <div key={g.name} className="mb-5">
            <GroupHeader
              g={g}
              others={p.groups.map(x => x.name).filter(n => n && n !== g.name)}
              onRename={to => p.onRenameGroup(g.name, to)}
              onUngroup={() => p.onUngroup(g.name)}
            />
            {g.servers.map(s => (
              <ServerRow
                key={s.id}
                s={s}
                check={p.checks[s.id]}
                probe={p.probeOf(s.id)}
                now={now}
                onCheck={() => p.onCheck(s.id)}
                onEdit={() => p.onEdit(s.id)}
                onRemove={() => p.onRemove(s.id)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
