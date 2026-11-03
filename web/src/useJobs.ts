import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import type { JobSnapshot } from './types'
import { acceptJob } from './lib/job-state'

type Started = api.Result<{ id: string; job: JobSnapshot }>

export function useJobs(onComplete: () => Promise<void>) {
  const [jobs, setJobs] = useState<JobSnapshot[]>([])
  const [pending, setPending] = useState<Set<string>>(new Set())
  const registry = useRef(new Map<string, JobSnapshot>())
  const dismissed = useRef(new Set<string>())
  const pendingRef = useRef(new Set<string>())

  const update = useCallback((job: JobSnapshot) => {
    if (!acceptJob(registry.current, job)) return false
    setJobs([...registry.current.values()])
    return true
  }, [])

  const patch = useCallback(
    (id: string, change: Partial<JobSnapshot>) => {
      const job = registry.current.get(id)
      if (job) update({ ...job, ...change })
    },
    [update]
  )

  const receive = useCallback(
    (job: JobSnapshot) => {
      if (dismissed.current.has(job.id)) {
        if (job.done) return
        dismissed.current.delete(job.id)
      }
      const previous = registry.current.get(job.id)
      if (!update(job)) return
      if (job.done && previous && !previous.done) void onComplete()
    },
    [onComplete, update]
  )

  useEffect(() => {
    let alive = true
    const reconcile = async () => {
      const known = new Set(registry.current.keys())
      const r = await api.getJobs()
      if (!alive || !r.ok) return
      for (const job of r.jobs) receive(job)
      for (const id of known) {
        const current = registry.current.get(id)
        if (!current || current.done || r.jobs.some(j => j.id === id)) continue
        update({
          ...current,
          done: true,
          connectionError: undefined,
          targets: current.targets.map(t =>
            t.status === 'running' || t.status === 'pending'
              ? { ...t, status: 'error', error: '服务已重启或任务已丢失，请重新执行方案。' }
              : t
          )
        })
      }
    }
    const unsubscribe = api.subscribeJobs(
      job => {
        if (alive) receive(job)
      },
      () => {
        if (!alive) return
        for (const job of registry.current.values())
          if (!job.done) {
            patch(job.id, { connectionError: '进度连接中断，正在重新连接；任务仍在后台执行。' })
          }
      },
      () => {
        void reconcile()
      }
    )
    void reconcile()
    return () => {
      alive = false
      unsubscribe()
    }
  }, [patch, receive, update])

  const lock = useCallback((key: string) => {
    if (pendingRef.current.has(key)) return false
    pendingRef.current.add(key)
    setPending(new Set(pendingRef.current))
    return true
  }, [])

  const unlock = useCallback((key: string) => {
    pendingRef.current.delete(key)
    setPending(new Set(pendingRef.current))
  }, [])

  const launch = useCallback(
    async (key: string, request: () => Promise<Started>): Promise<Started> => {
      const presetId = key.startsWith('preset:') ? key.slice(7) : null
      if ((presetId && [...registry.current.values()].some(j => j.presetId === presetId && !j.done)) || !lock(key)) {
        return { ok: false, error: '这个方案已有任务在进行中' }
      }
      try {
        const r = await request()
        if (r.ok) receive(r.job)
        return r
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      } finally {
        unlock(key)
      }
    },
    [receive, lock, unlock]
  )

  const retry = useCallback(
    async (id: string) => {
      const job = registry.current.get(id)
      if (!job?.done || !lock(`retry:${id}`)) return
      const presetKey = job.presetId ? `preset:${job.presetId}` : null
      if (presetKey && !lock(presetKey)) {
        unlock(`retry:${id}`)
        return patch(id, { actionError: '这个方案已有任务正在提交' })
      }
      patch(id, { actionError: undefined })
      try {
        const r = await api.retryJob(id)
        if (!r.ok) return patch(id, { actionError: api.why(r) })
        receive(r.job)
      } finally {
        if (presetKey) unlock(presetKey)
        unlock(`retry:${id}`)
      }
    },
    [receive, lock, patch, unlock]
  )

  const cancelJob = useCallback(
    async (id: string) => {
      if (!lock(`cancel:${id}`)) return
      patch(id, { actionError: undefined })
      try {
        const r = await api.cancelJob(id)
        if (!r.ok) patch(id, { actionError: api.why(r) })
      } finally {
        unlock(`cancel:${id}`)
      }
    },
    [lock, patch, unlock]
  )

  const dismissJob = useCallback((id: string) => {
    if (!registry.current.get(id)?.done || pendingRef.current.has(`retry:${id}`)) return
    dismissed.current.add(id)
    registry.current.delete(id)
    setJobs([...registry.current.values()])
  }, [])

  const revealJob = useCallback((id: string) => {
    const paths =
      registry.current.get(id)?.targets.flatMap(t => (t.status === 'done' && t.localPath ? [t.localPath] : [])) ?? []
    void window.desktop.reveal(paths)
  }, [])

  return { jobs, pending, launch, retry, cancelJob, dismissJob, revealJob }
}
