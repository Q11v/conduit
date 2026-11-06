import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptJob, destinationRefreshTokens, isSuccessfulJob } from '../web/src/lib/job-state.ts'

test('late start/retry responses cannot overwrite newer progress or completion events', () => {
  const registry = new Map()
  const finished = { id: 'a', revision: 5, done: true }
  assert.equal(acceptJob(registry, finished), true)
  assert.equal(acceptJob(registry, { id: 'a', revision: 2, done: false }), false)
  assert.equal(registry.get('a'), finished)
  assert.equal(acceptJob(registry, { id: 'a', revision: 6, done: false }), true)
  assert.equal(registry.get('a').done, false)
  assert.equal(acceptJob(registry, { id: 'b', revision: 1, done: false }), true)
  assert.equal(registry.size, 2)
})

test('upload completion refreshes the server pane without refreshing the local source', () => {
  const pull = { id: 'old-pull', revision: 5, kind: 'pull', done: true }
  const upload = { id: 'upload', revision: 1, kind: 'push', done: false }
  const before = destinationRefreshTokens([pull, upload])
  const progress = destinationRefreshTokens([pull, { ...upload, revision: 2 }])
  assert.deepEqual(progress, before)
  const after = destinationRefreshTokens([pull, { ...upload, revision: 3, done: true }])
  assert.equal(after.local, before.local)
  assert.notEqual(after.remote, before.remote)
})

test('pull completion refreshes the local pane without refreshing the remote source', () => {
  const upload = { id: 'old-upload', revision: 5, kind: 'push', done: true }
  const pull = { id: 'pull', revision: 1, kind: 'pull', done: false }
  const before = destinationRefreshTokens([upload, pull])
  const after = destinationRefreshTokens([upload, { ...pull, revision: 2, done: true }])
  assert.notEqual(after.local, before.local)
  assert.equal(after.remote, before.remote)
  assert.deepEqual(destinationRefreshTokens([{ ...pull, revision: 2, done: true }, upload]), after)
})

test('only fully successful completed transfers are folded into completed history', () => {
  const job = { done: true, targets: [{ status: 'done' }, { status: 'done' }] }
  assert.equal(isSuccessfulJob(job), true)
  assert.equal(isSuccessfulJob({ ...job, done: false }), false)
  assert.equal(isSuccessfulJob({ ...job, targets: [{ status: 'done' }, { status: 'error', error: 'failed' }] }), false)
  assert.equal(isSuccessfulJob({ ...job, targets: [{ status: 'error', error: '已取消' }] }), false)
  assert.equal(isSuccessfulJob({ ...job, actionError: 'retry failed' }), false)
  assert.equal(isSuccessfulJob({ ...job, connectionError: 'disconnected' }), false)
  assert.equal(isSuccessfulJob({ ...job, targets: [] }), false)
})
