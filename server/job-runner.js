import { createScheduler } from './scheduler.js'

export function createJobRunner({ parallel, startTask, resourcesFor, publish, event }) {
  const scheduler = createScheduler(parallel)

  function runJob(job, keys) {
    job.scheduled ??= new Map()
    for (const key of keys) {
      const t = job.targets.get(key)
      Object.assign(t, { status: 'pending', percent: 0, error: null, speed: null, eta: null, waiting: null })
    }
    publish(job)
    return Promise.all(
      keys.map(async key => {
        const t = job.targets.get(key)
        const queued = scheduler.enqueue(
          resourcesFor(job, t),
          async () => {
            if (job.cancelled) throw new Error('已取消')
            Object.assign(t, { status: 'running', percent: 0, waiting: null, trace: [] })
            publish(job)
            const started = Date.now()
            try {
              const task = startTask(job, t, p => {
                Object.assign(t, p)
                publish(job)
              })
              job.running.set(key, task)
              const { remoteDir, localPath } = await task
              if (job.cancelled) throw new Error('已取消')
              Object.assign(t, { status: 'done', percent: 100, remoteDir, localPath })
              const secs = ((Date.now() - started) / 1000).toFixed(1)
              event(
                'OK',
                job.kind === 'pull'
                  ? `${t.label} ${t.dir} 拉取完成，${secs}s → ${localPath}`
                  : `${t.label} ${t.dir} 完成，${secs}s → ${remoteDir}`,
                t.trace
              )
            } finally {
              job.running.delete(key)
            }
          },
          waiting => {
            if (t.waiting === waiting) return
            t.waiting = waiting
            publish(job)
          }
        )
        job.scheduled.set(key, queued)
        try {
          await queued
        } catch (err) {
          t.status = 'error'
          t.error = err.message
          t.waiting = null
          event(err.message === '已取消' ? 'WARN' : 'FAIL', `${t.label} ${t.dir} ${err.message}`, t.trace)
        } finally {
          job.scheduled.delete(key)
          publish(job)
        }
      })
    )
  }

  function cancelJob(job) {
    job.cancelled = true
    for (const pending of job.scheduled?.values() ?? []) pending.cancel()
    for (const task of job.running.values()) task.cancel()
  }

  return { runJob, cancelJob }
}
