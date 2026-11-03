import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptJob } from '../web/src/lib/job-state.ts'

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
