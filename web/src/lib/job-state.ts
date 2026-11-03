import type { JobSnapshot } from '../types'

export function acceptJob(registry: Map<string, JobSnapshot>, job: JobSnapshot): boolean {
  const current = registry.get(job.id)
  if (current && current.revision > job.revision) return false
  registry.set(job.id, job)
  return true
}
