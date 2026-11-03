import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createScheduler } from './scheduler.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
const resource = (path, scope = 'host-a', read = false) => [{ scope, path, read }]
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test('all jobs share a single concurrency budget', async () => {
  const scheduler = createScheduler(2)
  const gates = Array.from({ length: 5 }, deferred)
  let running = 0,
    peak = 0
  const started = []
  const tasks = gates.map((gate, i) =>
    scheduler.enqueue(resource(`/app-${i}`), async () => {
      started.push(i)
      peak = Math.max(peak, ++running)
      await gate.promise
      running--
    })
  )
  await flush()
  assert.deepEqual(started, [0, 1])
  gates[0].resolve()
  await flush()
  assert.deepEqual(started, [0, 1, 2])
  for (const gate of gates) gate.resolve()
  await Promise.all(tasks)
  assert.equal(peak, 2)
})

test('conflicting writes retain order while unrelated targets bypass them', async () => {
  const scheduler = createScheduler(4)
  const gate = deferred()
  const started = []
  const tasks = [
    scheduler.enqueue(resource('/app/'), async () => {
      started.push('first')
      await gate.promise
    }),
    scheduler.enqueue(resource('/app/./release'), () => started.push('second')),
    scheduler.enqueue(resource('/app'), () => started.push('third')),
    scheduler.enqueue(resource('/app', 'host-b'), () => started.push('other host')),
    scheduler.enqueue(resource('/application'), () => started.push('other directory'))
  ]
  await flush()
  assert.deepEqual(started, ['first', 'other host', 'other directory'])
  gate.resolve()
  await Promise.all(tasks)
  assert.deepEqual(started, ['first', 'other host', 'other directory', 'second', 'third'])
})

test('cancelling a queued transfer never invokes it or consumes a slot', async () => {
  const scheduler = createScheduler(1)
  const gate = deferred()
  const first = scheduler.enqueue([], () => gate.promise)
  let called = false
  const cancelled = scheduler.enqueue([], () => {
    called = true
  })
  const rejected = assert.rejects(cancelled, /已取消/)
  cancelled.cancel()
  const next = scheduler.enqueue([], () => 'next')
  await rejected
  gate.resolve()
  await first
  assert.equal(await next, 'next')
  assert.equal(called, false)
})

test('failure releases both the slot and target lock', async () => {
  const scheduler = createScheduler(1)
  const failed = scheduler.enqueue(resource('/app'), () => {
    throw new Error('offline')
  })
  const next = scheduler.enqueue(resource('/app'), () => 'recovered')
  await assert.rejects(failed, /offline/)
  assert.equal(await next, 'recovered')
})

test('remote reads can overlap; writes and home-relative paths wait', async () => {
  const scheduler = createScheduler(4)
  const gate = deferred()
  const started = []
  const first = scheduler.enqueue(resource('/app', 'a', true), async () => {
    started.push('read1')
    await gate.promise
  })
  const read = scheduler.enqueue(resource('/app', 'a', true), () => started.push('read2'))
  const write = scheduler.enqueue(resource('/app', 'a'), () => started.push('write'))
  const home = scheduler.enqueue(resource('~/other', 'a'), () => started.push('home'))
  await flush()
  assert.deepEqual(started, ['read1', 'read2'])
  gate.resolve()
  await Promise.all([first, read, write, home])
  assert.deepEqual(started, ['read1', 'read2', 'write', 'home'])
})

test('tasks reserve all resources atomically, including local pull destinations', async () => {
  const scheduler = createScheduler(3)
  const gate = deferred()
  const first = scheduler.enqueue(
    [...resource('/app', 'remote-a', true), ...resource('/downloads', 'local')],
    () => gate.promise
  )
  let started = false
  const second = scheduler.enqueue(
    [...resource('/other', 'remote-b', true), ...resource('/downloads/pkg', 'local')],
    () => {
      started = true
    }
  )
  await flush()
  assert.equal(started, false)
  gate.resolve()
  await Promise.all([first, second])
  assert.equal(started, true)
})
