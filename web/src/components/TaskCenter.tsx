import { useState } from 'react'
import { isSuccessfulJob } from '../lib/job-state'
import { PushProgress } from './PushProgress'
import { Chevron } from './Icons'
import { Btn } from './ui'
import type { JobSnapshot } from '../types'

interface Props {
  jobs: JobSnapshot[]
  pending: Set<string>
  parallel: number
  onDismiss: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onReveal: (id: string) => void
}

export function TaskCenter({ jobs, pending, parallel, onDismiss, onCancel, onRetry, onReveal }: Props) {
  const [open, setOpen] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  if (!jobs.length) return null
  const active = jobs.filter(j => !j.done)
  const completed = jobs.length - active.length
  const running = active.flatMap(j => j.targets).filter(t => t.status === 'running').length
  const waiting = active.flatMap(j => j.targets).filter(t => t.status === 'pending').length
  const ordered = [...jobs].sort(
    (a, b) => Number(a.done) - Number(b.done) || (b.createdAt || '').localeCompare(a.createdAt || '')
  )

  const successful = ordered.filter(isSuccessfulJob)
  const visible = ordered.filter(job => !isSuccessfulJob(job))
  const attention = visible.filter(job => job.done).length
  const expanded = open && (visible.length > 0 || (showCompleted && successful.length > 0))
  const renderJob = (job: JobSnapshot, compact = false) => (
    <PushProgress
      key={job.id}
      job={job}
      compact={compact}
      pending={pending.has(`retry:${job.id}`) || pending.has(`cancel:${job.id}`)}
      onDismiss={() => onDismiss(job.id)}
      onCancel={() => onCancel(job.id)}
      onRetry={() => onRetry(job.id)}
      onReveal={job.kind === 'pull' ? () => onReveal(job.id) : undefined}
    />
  )

  return (
    <section aria-label="任务中心" className="relative z-16 shrink-0 bg-ink-panel">
      <div className="w-full max-w-[1400px] mx-auto px-6">
        <div className="flex items-center gap-3 py-3">
          <button
            type="button"
            onClick={() => {
              if (expanded) setOpen(false)
              else {
                setOpen(true)
                setShowCompleted(true)
              }
            }}
            aria-expanded={expanded}
            aria-controls="transfer-tasks"
            className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer"
          >
            <Chevron size={14} className={expanded ? 'rotate-90' : ''} />
            任务中心{' '}
            <span className="text-mute font-normal">
              {active.length} 进行中{attention > 0 ? ` · ${attention} 需处理` : ''}
            </span>
          </button>
          <span className="flex-1" />
          {active.length > 0 && (
            <span className="hidden sm:inline text-[12px] text-mute-3">
              {running}/{parallel} 路传输 · {waiting} 个目标等待
            </span>
          )}
          {successful.length > 0 && (
            <button
              type="button"
              aria-expanded={open && showCompleted}
              aria-controls="completed-transfers"
              onClick={() => {
                setShowCompleted(!open || !showCompleted)
                setOpen(true)
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-mute hover:bg-white/5 hover:text-fg cursor-pointer"
            >
              <Chevron size={12} className={open && showCompleted ? 'rotate-90' : ''} />
              已完成 {successful.length}
            </button>
          )}
          {completed > 0 && (
            <Btn
              onClick={() => jobs.filter(j => j.done).forEach(j => onDismiss(j.id))}
              className="px-2 py-1 text-[12px]"
            >
              清除已结束
            </Btn>
          )}
        </div>
        {expanded && (
          <div id="transfer-tasks" className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto pb-3">
            {visible.map(job => renderJob(job))}
            {showCompleted && successful.length > 0 && (
              <div id="completed-transfers">{successful.map(job => renderJob(job, true))}</div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
