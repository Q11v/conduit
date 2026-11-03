import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createJobRunner } from './job-runner.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
function job(id, paths) {
  return {
    id,
    kind: 'push',
    running: new Map(),
    cancelled: false,
    targets: new Map(paths.map(dir => [dir, { key: dir, label: id, dir, status: 'pending' }]))
  }
}
function fixture(parallel) {
  const started = [],
    tasks = new Map(),
    snapshots = []
  const runner = createJobRunner({
    parallel,
    resourcesFor: (_job, t) => [{ scope: 'remote', path: t.dir }],
    publish: job => snapshots.push([...job.targets.values()].map(t => ({ ...t }))),
    event: () => {},
    startTask: (job, t) => {
      let resolve, reject
      const promise = new Promise((yes, no) => {
        resolve = yes
        reject = no
      })
      promise.cancel = () => reject(new Error('已取消'))
      started.push(`${job.id}:${t.key}`)
      tasks.set(`${job.id}:${t.key}`, { resolve, reject })
      return promise
    }
  })
  return { ...runner, started, tasks, snapshots }
}

test('separate jobs execute independently but respect shared concurrency', async () => {
  const f = fixture(2),
    a = job('a', ['/one', '/two']),
    b = job('b', ['/three'])
  const doneA = f.runJob(a, [...a.targets.keys()]),
    doneB = f.runJob(b, [...b.targets.keys()])
  await flush()
  assert.deepEqual(f.started, ['a:/one', 'a:/two'])
  f.tasks.get('a:/one').resolve({ remoteDir: '/one' })
  await flush()
  assert.equal(b.targets.get('/three').status, 'running')
  f.tasks.get('a:/two').resolve({ remoteDir: '/two' })
  f.tasks.get('b:/three').resolve({ remoteDir: '/three' })
  await Promise.all([doneA, doneB])
  assert.equal(a.running.size + b.running.size, 0)
})

test('cancelling one job stops its running and queued targets without cancelling others', async () => {
  const f = fixture(1),
    a = job('a', ['/one', '/two']),
    b = job('b', ['/three'])
  const doneA = f.runJob(a, [...a.targets.keys()]),
    doneB = f.runJob(b, [...b.targets.keys()])
  await flush()
  f.cancelJob(a)
  await doneA
  await flush()
  assert.deepEqual(f.started, ['a:/one', 'b:/three'])
  for (const t of a.targets.values()) assert.equal(t.error, '已取消')
  assert.equal(b.cancelled, false)
  f.tasks.get('b:/three').resolve({ remoteDir: '/three' })
  await doneB
})

test('a job queued behind a conflicting target can be cancelled immediately', async () => {
  const f = fixture(2),
    a = job('a', ['/app']),
    b = job('b', ['/app'])
  const doneA = f.runJob(a, ['/app']),
    doneB = f.runJob(b, ['/app'])
  await flush()
  assert.equal(b.targets.get('/app').waiting, '等待相同目标的任务完成')
  f.cancelJob(b)
  await doneB
  assert.equal(b.targets.get('/app').error, '已取消')
  assert.deepEqual(f.started, ['a:/app'])
  f.tasks.get('a:/app').resolve({ remoteDir: '/app' })
  await doneA
})

test('retry marks all selected failures pending before publishing and does not rerun successes', async () => {
  const f = fixture(1),
    a = job('a', ['/ok', '/bad'])
  a.targets.get('/ok').status = 'done'
  a.targets.get('/bad').status = 'error'
  a.targets.get('/bad').error = 'offline'
  const done = f.runJob(a, ['/bad'])
  assert.deepEqual(
    f.snapshots[0].map(t => t.status),
    ['done', 'pending']
  )
  await flush()
  assert.deepEqual(f.started, ['a:/bad'])
  f.tasks.get('a:/bad').resolve({ remoteDir: '/bad' })
  await done
  assert.equal(a.targets.get('/bad').status, 'done')
  assert.equal(a.targets.get('/bad').error, null)
})
