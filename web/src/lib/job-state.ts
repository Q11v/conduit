import type { JobSnapshot } from '../types'

export function acceptJob(registry: Map<string, JobSnapshot>, job: JobSnapshot): boolean {
  const current = registry.get(job.id)
  if (current && current.revision > job.revision) return false
  registry.set(job.id, job)
  return true
}

// A completed transfer invalidates the receiving pane only.
export function destinationRefreshTokens(jobs: readonly JobSnapshot[]) {
  const token = (kind: JobSnapshot['kind']) =>
    jobs
      .filter(job => job.done && job.kind === kind)
      .map(job => `${job.id}:${job.revision}`)
      .sort()
      .join('|')
  return { local: token('pull'), remote: token('push') }
}

export function isSuccessfulJob(job: JobSnapshot): boolean {
  return (
    job.done &&
    job.targets.length > 0 &&
    job.targets.every(target => target.status === 'done') &&
    !job.connectionError &&
    !job.actionError
  )
}
