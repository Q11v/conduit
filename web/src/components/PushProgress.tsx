import { useState } from 'react'
import { Check, Chevron, Close } from './Icons'
import { Btn } from './ui'
import type { JobSnapshot, JobTarget } from '../types'

const CANCELLED = '已取消'

const tilde = (p: string) => p.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~')

// 所有路径共同的父目录（带结尾 /），没有则返回 ''
function commonDir(paths: string[]) {
  const split = paths.map(p => p.replace(/\/+$/, '').split('/').slice(0, -1))
  const first = split[0] ?? []
  let n = first.length
  for (const parts of split) {
    let i = 0
    while (i < n && parts[i] === first[i]) i++
    n = i
  }
  return n > 0 ? first.slice(0, n).join('/') + '/' : ''
}

const note = (t: JobTarget, expectedLocal?: string) => {
  if (t.status === 'running') return [t.speed, t.eta && `剩 ${t.eta}`].filter(Boolean).join(' · ')
  if (t.status === 'pending') return '等待中'
  if (t.status === 'done' && t.localPath && t.localPath !== expectedLocal) return `→ ${tilde(t.localPath)}`
  if (t.status === 'done' && t.remoteDir && t.remoteDir !== t.dir) return `→ ${t.remoteDir}`
  return ''
}

function StatusDot({ t }: { t: JobTarget }) {
  if (t.status === 'done' || t.status === 'error') {
    const done = t.status === 'done'
    return (
      <svg
        width={11}
        height={11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={done ? 'text-ok-text' : 'text-err-text'}
      >
        <path d={done ? 'M20 6 9 17l-5-5' : 'M18 6 6 18M6 6l12 12'} />
      </svg>
    )
  }
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${t.status === 'running' ? 'bg-violet-text animate-cdt-pulse' : 'bg-[rgba(255,255,255,.2)]'}`}
    />
  )
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

  // 拉取任务：同一台服务器、同一个本地目录，公共部分只在顶部显示一次
  const labels = new Set(job.targets.map(t => t.label))
  const oneHost = pulling && labels.size === 1
  const base = pulling ? commonDir(job.targets.map(t => t.dir)) : ''
  const nameOf = (t: JobTarget) => (base && t.dir.startsWith(base) ? t.dir.slice(base.length) : t.dir)
  const localOf = (t: JobTarget) =>
    job.localDir && `${job.localDir.replace(/\/+$/, '')}/${t.dir.replace(/\/+$/, '').split('/').pop()}`

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
            <div className="border-t hair">
              {pulling && (oneHost || base || job.localDir) && (
                <div className="flex items-center gap-2 min-w-0 px-4 pt-2.5 pb-1 font-mono text-[12px] text-mute-3">
                  <span className="min-w-0 truncate" title={`${oneHost ? [...labels][0] + ':' : ''}${base}`}>
                    {oneHost && <span className="font-sans text-fg-dim">{[...labels][0]}</span>}
                    {oneHost && base && <span className="text-mute-4">:</span>}
                    {base}
                  </span>
                  {job.localDir && (
                    <>
                      <span className="shrink-0 text-mute-4">→</span>
                      <span className="min-w-0 truncate text-fg-dim" title={job.localDir}>
                        {tilde(job.localDir)}
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="max-h-[42vh] overflow-auto px-4 pt-1 pb-2.5">
                {rows.map(t => {
                  const pct = t.status === 'done' ? 100 : (t.percent ?? 0)
                  const foot = note(t, pulling ? localOf(t) : undefined)
                  const name = pulling ? nameOf(t) : t.label
                  const showBar = !job.done && t.status !== 'done' && t.status !== 'error'
                  return (
                    <div key={t.key} className="py-1">
                      <div className="grid grid-cols-[14px_minmax(0,1fr)_minmax(80px,32%)_auto] items-center gap-x-3 min-h-6">
                        <span className="flex items-center justify-center">
                          <StatusDot t={t} />
                        </span>

                        <span className="flex items-center gap-2 min-w-0">
                          {pulling && !oneHost && <span className="shrink-0 text-[12.5px] text-fg-dim">{t.label}</span>}
                          {!pulling && <span className="shrink-0 text-[13px] whitespace-nowrap">{t.label}</span>}
                          <span
                            className={`min-w-0 truncate font-mono text-[12px] ${pulling ? 'text-fg' : 'px-1.5 py-px rounded bg-[rgba(255,255,255,.07)] text-mute-2'}`}
                            title={t.dir}
                          >
                            {pulling ? name : t.label !== t.spec ? t.dir : ''}
                          </span>
                        </span>

                        {showBar ? (
                          <div className="h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,.1)]">
                            <div
                              className="h-full rounded-full transition-[width] duration-200"
                              style={{
                                width: `${pct}%`,
                                background: 'linear-gradient(90deg,var(--color-violet-hi),var(--color-cyan))'
                              }}
                            />
                          </div>
                        ) : (
                          <span />
                        )}

                        <span
                          className="min-w-0 max-w-[22rem] truncate text-right font-mono text-[11.5px] text-mute-3 tabular-nums"
                          title={foot}
                        >
                          {showBar && t.status === 'running' && t.percent != null && (
                            <span className="text-fg-dim">{Math.round(t.percent)}%</span>
                          )}
                          {showBar && t.status === 'running' && t.percent != null && foot && ' · '}
                          {foot}
                        </span>
                      </div>

                      {t.error && (
                        <div className="mt-0.5 pl-[26px] text-[12px] leading-snug text-err-text break-words">
                          {t.error}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
