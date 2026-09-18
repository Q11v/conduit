import { useState } from 'react'
import { Check, Chevron, Close } from './Icons'
import { Btn } from './ui'
import type { JobSnapshot, JobTarget } from '../types'

const CANCELLED = '已取消'

const note = (t: JobTarget) => {
  if (t.status === 'running') return [t.speed, t.eta && `剩 ${t.eta}`].filter(Boolean).join(' · ')
  if (t.status === 'done' && t.localPath) return `→ ${t.localPath}`
  if (t.status === 'done' && t.remoteDir && t.remoteDir !== t.dir) return `→ ${t.remoteDir}`
  return ''
}

interface Props {
  job: JobSnapshot
  onDismiss: () => void
  onCancel: () => void
  onRetry: () => void
  onReveal?: () => void
}

export function PushProgress({ job, onDismiss, onCancel, onRetry, onReveal }: Props) {
  const [open, setOpen] = useState(false)

  const cancelled = job.targets.filter(t => t.error === CANCELLED).length
  const failed = job.targets.filter(t => t.status === 'error' && t.error !== CANCELLED)
  const ok = job.targets.filter(t => t.status === 'done').length
  const running = job.targets.filter(t => t.status === 'running' || t.status === 'pending').length
  const clean = job.done && failed.length === 0 && cancelled === 0
  const showRows = !job.done || !clean || open

  const accent = !job.done
    ? { ring: 'rgba(124,124,245,.5)', fg: 'var(--color-violet-text)', bg: 'rgba(124,124,245,.16)' }
    : failed.length > 0
      ? { ring: 'rgba(226,86,86,.45)', fg: 'var(--color-err-text)', bg: 'rgba(226,86,86,.16)' }
      : { ring: 'rgba(62,207,142,.4)', fg: 'var(--color-ok-text)', bg: 'rgba(62,207,142,.14)' }

  const pulling = job.kind === 'pull'
  const summary = !job.done
    ? `正在${pulling ? '拉取' : '推送'} · ${ok}/${job.targets.length}`
    : [
        ok > 0 && `${ok} ${pulling ? '项' : '个目标'}完成`,
        failed.length > 0 && `${failed.length} 失败`,
        cancelled > 0 && `${cancelled} 已取消`
      ]
        .filter(Boolean)
        .join(' · ')

  const rows = !job.done ? job.targets : clean ? job.targets : failed

  return (
    <div className="fixed left-0 right-0 bottom-0 z-16 pointer-events-none">
      <div className="h-16 bg-linear-[to_top,var(--color-ink),transparent]" />
      <div className="px-5 pb-5 bg-ink">
        <div
          className="pointer-events-auto max-w-[1000px] mx-auto border rounded-2xl bg-ink-float elevated overflow-hidden animate-cdt-pop"
          style={{ borderColor: accent.ring }}
        >
          <div className="flex items-center gap-3 flex-wrap px-4 py-3">
            <span
              className="flex shrink-0 items-center justify-center w-[22px] h-[22px] rounded-full"
              style={{ background: accent.bg, color: accent.fg }}
            >
              {!job.done ? (
                <span className="w-1.5 h-1.5 rounded-full animate-cdt-pulse" style={{ background: accent.fg }} />
              ) : failed.length > 0 ? (
                <Close size={12} />
              ) : (
                <Check size={12} />
              )}
            </span>

            <span className="text-[13px] font-semibold" style={{ color: accent.fg }}>
              {summary}
            </span>
            {!job.done && running > 0 && <span className="text-[12px] text-mute-3">{running} 个进行中</span>}

            <span className="flex-1" />

            {clean && (
              <Btn
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg"
              >
                <Chevron size={12} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
                {open ? '收起' : '详情'}
              </Btn>
            )}
            {pulling && onReveal && job.done && ok > 0 && (
              <Btn onClick={onReveal} className="px-3 py-1.5 text-[12px] rounded-lg">
                打开本地目录
              </Btn>
            )}
            {job.done && failed.length > 0 && (
              <Btn onClick={onRetry} className="px-3 py-1.5 text-[12px] rounded-lg">
                重试失败项（{failed.length}）
              </Btn>
            )}
            <Btn onClick={job.done ? onDismiss : onCancel} className="px-3 py-1.5 text-[12px] rounded-lg">
              {job.done ? '关闭' : '全部取消'}
            </Btn>
          </div>

          {showRows && rows.length > 0 && (
            <div className="px-4 pb-3 border-t hair pt-2">
              {rows.map(t => {
                const pct = t.status === 'done' ? 100 : (t.percent ?? 0)
                const foot = note(t)
                return (
                  <div key={t.key} className="py-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="shrink-0 text-[13px] whitespace-nowrap">{t.label}</span>
                      {t.dir && t.label !== t.spec && (
                        <span className="shrink-0 px-1.5 py-px rounded bg-[rgba(255,255,255,.07)] font-mono text-[12px] text-mute-2">
                          {t.dir}
                        </span>
                      )}

                      {!job.done && (
                        <div
                          className="flex-1 min-w-[80px] h-1 rounded-full overflow-hidden"
                          style={{ background: 'rgba(255,255,255,.1)' }}
                        >
                          <div
                            className="h-full rounded-full transition-[width] duration-200"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg,var(--color-violet-hi),var(--color-cyan))'
                            }}
                          />
                        </div>
                      )}
                      {job.done && <span className="flex-1" />}

                      {foot && (
                        <span className="shrink-0 font-mono text-[12px] text-mute-3 whitespace-nowrap">{foot}</span>
                      )}
                    </div>

                    {t.error && (
                      <div className="mt-1 text-[12px] leading-snug text-err-text break-words">{t.error}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
