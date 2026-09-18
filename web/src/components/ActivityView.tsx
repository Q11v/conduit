import type { ActivityEvent } from '../types'

const TAG: Record<string, [string, string]> = {
  OK: ['rgba(62,207,142,.14)', 'var(--color-ok-text)'],
  PUT: ['rgba(124,124,245,.16)', 'var(--color-violet-text)'],
  GET: ['rgba(106,213,230,.14)', 'var(--color-cyan)'],
  WARN: ['rgba(223,180,60,.14)', 'var(--color-warn-text)'],
  FAIL: ['rgba(226,86,86,.16)', 'var(--color-err-text)'],
  TEST: ['rgba(255,255,255,.07)', 'var(--color-fg-dim)']
}
const FALLBACK: [string, string] = ['rgba(255,255,255,.07)', 'var(--color-fg-dim)']

const hhmmss = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

interface Props {
  events: ActivityEvent[]
  failedOnly: boolean
  onFailedOnly: (v: boolean) => void
}

export function ActivityView({ events, failedOnly, onFailedOnly }: Props) {
  const rows = failedOnly ? events.filter(e => e.level === 'FAIL') : events

  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <h2 className="m-0 shrink-0 text-[19px] font-semibold tracking-[-0.02em]">活动记录</h2>
        <span className="shrink-0 whitespace-nowrap text-[13px] text-mute-2">本进程启动以来 {events.length} 条</span>
        <div className="flex-1" />
        <div className="flex shrink-0 gap-[2px] p-[3px] rounded-[9px] bg-[rgba(255,255,255,.05)] border hair">
          {[
            ['全部', false],
            ['仅失败', true]
          ].map(([label, on]) => (
            <button
              key={String(label)}
              onClick={() => onFailedOnly(on as boolean)}
              className={`px-[11px] py-1 border-0 rounded-md text-xs cursor-pointer transition-all duration-150 ${
                failedOnly === on ? 'bg-[rgba(255,255,255,.1)] text-fg' : 'bg-transparent text-mute-2 hover:text-fg-dim'
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <div className="border hair-2 rounded-2xl panel overflow-hidden">
        {rows.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="m-0 mb-2 text-[13px] text-fg-dim">{failedOnly ? '没有失败记录' : '还没有活动'}</p>
            <p className="m-0 text-[13px] leading-relaxed text-mute-2">
              推送和检测会记在这里。逐条 ssh / rsync 命令仍然打在
              <span className="font-mono text-fg-dim"> npm start </span>
              的终端里，
              <br />
              那里的命令可以直接复制重跑 —— 排障先看那边。
            </p>
          </div>
        )}

        {rows.map((e, i) => {
          const [bg, fg] = TAG[e.level] ?? FALLBACK
          return (
            <div key={`${e.t}-${i}`} className="flex items-start gap-3 px-4 py-[11px] border-b hair last:border-b-0">
              <span className="shrink-0 w-[66px] font-mono text-[12px] text-mute-4">{hhmmss(e.t)}</span>
              <span
                className="shrink-0 w-[54px] text-center rounded-md text-[12px] font-semibold tracking-[.06em] leading-[19px]"
                style={{ background: bg, color: fg }}
              >
                {e.level}
              </span>
              <span className="flex-1 min-w-0 font-mono text-[12px] leading-relaxed text-fg-dim break-all">
                {e.msg}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
