import { useState } from 'react'
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
  if (!jobs.length) return null
  const active = jobs.filter(j => !j.done)
  const completed = jobs.length - active.length
  const running = active.flatMap(j => j.targets).filter(t => t.status === 'running').length
  const waiting = active.flatMap(j => j.targets).filter(t => t.status === 'pending').length
  const ordered = [...jobs].sort(
    (a, b) => Number(a.done) - Number(b.done) || (b.createdAt || '').localeCompare(a.createdAt || '')
  )

  return (
    <section aria-label="任务中心" className="fixed inset-x-0 bottom-0 z-16 px-5 pb-4 pointer-events-none">
      <div className="max-w-[1000px] mx-auto border hair-3 rounded-2xl bg-ink-float elevated overflow-hidden pointer-events-auto">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="transfer-tasks"
            className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer"
          >
            <Chevron size={14} className={open ? 'rotate-90' : '-rotate-90'} />
            任务中心{' '}
            <span className="text-mute font-normal">
              {active.length} 进行中 · {completed} 已结束
            </span>
          </button>
          <span className="flex-1" />
          <span className="hidden sm:inline text-[12px] text-mute-3">
            {running}/{parallel} 路传输 · {waiting} 个目标等待
          </span>
          {completed > 0 && (
            <Btn
              onClick={() => jobs.filter(j => j.done).forEach(j => onDismiss(j.id))}
              className="px-2 py-1 text-[12px]"
            >
              清除已结束
            </Btn>
          )}
        </div>
        {open && (
          <div id="transfer-tasks" className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto px-3 pb-3">
            {ordered.map(job => (
              <PushProgress
                key={job.id}
                job={job}
                pending={pending.has(`retry:${job.id}`) || pending.has(`cancel:${job.id}`)}
                onDismiss={() => onDismiss(job.id)}
                onCancel={() => onCancel(job.id)}
                onRetry={() => onRetry(job.id)}
                onReveal={job.kind === 'pull' ? () => onReveal(job.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
