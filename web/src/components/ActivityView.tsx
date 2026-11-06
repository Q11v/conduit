import { useId, useState } from 'react'
import { Chevron, Copy } from './Icons'
import { Btn, IconBtn } from './ui'
import type { ActivityEvent } from '../types'

const TAG: Record<string, [string, string]> = {
  OK: ['rgba(62,207,142,.14)', 'var(--color-ok-text)'],
  PUT: ['rgba(124,124,245,.16)', 'var(--color-violet-text)'],
  GET: ['rgba(106,213,230,.14)', 'var(--color-cyan)'],
  WARN: ['rgba(223,180,60,.14)', 'var(--color-warn-text)'],
  FAIL: ['rgba(226,86,86,.16)', 'var(--color-err-text)'],
  TEST: ['rgba(var(--surface-rgb),.07)', 'var(--color-fg-dim)']
}
const FALLBACK: [string, string] = ['rgba(var(--surface-rgb),.07)', 'var(--color-fg-dim)']

const when = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ['', '--:--:--']
  const p = (n: number) => String(n).padStart(2, '0')
  const day = d.toDateString() === new Date().toDateString() ? '' : `${d.getMonth() + 1}/${d.getDate()}`
  return [day, `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`]
}

interface Props {
  events: ActivityEvent[]
  failedOnly: boolean
  onFailedOnly: (v: boolean) => void
  logFile: string
}

function Row({ e }: { e: ActivityEvent }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const fullText = e.detail ? `${e.msg}\n\n${e.detail}` : e.msg
  const [bg, fg] = TAG[e.level] ?? FALLBACK
  const [day, time] = when(e.t)
  return (
    <div className="border-b hair last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="flex w-full items-center gap-3 px-4 py-[11px] text-left cursor-pointer hover:bg-[rgba(var(--surface-rgb),.025)]"
      >
        <span
          className="shrink-0 w-[112px] whitespace-nowrap font-mono text-[12px] leading-[19px] text-mute-4 tabular-nums"
          title={e.t}
        >
          {day && `${day} `}
          {time}
        </span>
        <span
          className="shrink-0 w-[54px] text-center rounded-md text-[12px] font-semibold tracking-[.06em] leading-[19px]"
          style={{ background: bg, color: fg }}
        >
          {e.level}
        </span>
        <span className="flex-1 min-w-0 truncate font-mono text-[12px] leading-[19px] text-fg-dim">{e.msg}</span>
        <Chevron
          size={12}
          className={`shrink-0 text-mute-3 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div id={detailsId} className="relative mx-4 mb-3 sm:ml-[206px] rounded-lg sunken border hair">
          <IconBtn
            onClick={() => void navigator.clipboard.writeText(fullText)}
            title="复制"
            aria-label="复制详情"
            className="absolute right-1.5 top-1.5 w-7 h-7"
          >
            <Copy size={12} />
          </IconBtn>
          <pre className="m-0 p-3 pr-10 max-h-80 overflow-auto font-mono text-[12px] leading-relaxed text-fg-dim whitespace-pre-wrap break-all select-text">
            {fullText}
          </pre>
        </div>
      )}
    </div>
  )
}

export function ActivityView({ events, failedOnly, onFailedOnly, logFile }: Props) {
  const rows = failedOnly ? events.filter(e => e.level === 'FAIL') : events

  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <h2 className="m-0 shrink-0 text-[19px] font-semibold tracking-[-0.02em]">活动记录</h2>
        <span className="shrink-0 whitespace-nowrap text-[13px] text-mute-2">
          最近 {events.length} 条 · 点击查看完整内容与命令输出
        </span>
        <div className="flex-1" />
        {logFile && (
          <Btn
            onClick={() => void window.desktop.reveal([logFile])}
            title={logFile}
            className="px-3 py-1.5 text-xs rounded-[9px]"
          >
            完整日志文件
          </Btn>
        )}
        <div className="flex shrink-0 gap-[2px] p-[3px] rounded-[9px] bg-[rgba(var(--surface-rgb),.05)] border hair">
          {[
            ['全部', false],
            ['仅失败', true]
          ].map(([label, on]) => (
            <button
              key={String(label)}
              onClick={() => onFailedOnly(on as boolean)}
              className={`px-[11px] py-1 border-0 rounded-md text-xs cursor-pointer transition-all duration-150 ${
                failedOnly === on
                  ? 'bg-[rgba(var(--surface-rgb),.1)] text-fg'
                  : 'bg-transparent text-mute-2 hover:text-fg-dim'
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
              推送、拉取和检测会记在这里，点开一条能看到执行的 ssh / rsync 命令、退出码和完整报错，
              <br />
              命令可以直接复制到终端重跑。所有请求和命令另外写在「完整日志文件」里。
            </p>
          </div>
        )}

        {rows.map((e, i) => (
          <Row key={`${e.t}-${i}`} e={e} />
        ))}
      </div>
    </div>
  )
}
