import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortEntries, formatModified } from '../web/src/lib/file-list.ts'

const entries = [
  { name: 'file10', type: 'file', size: 30, modifiedAt: 1000 },
  { name: 'unknown', type: 'file', size: null, modifiedAt: null },
  { name: 'folder', type: 'dir', size: null, modifiedAt: 3000 },
  { name: 'file2', type: 'file', size: 0, modifiedAt: 2000 }
]

test('file sorting is numeric, keeps directories first and does not mutate listings', () => {
  assert.deepEqual(
    sortEntries(entries, { key: 'name', descending: false }).map(e => e.name),
    ['folder', 'file2', 'file10', 'unknown']
  )
  assert.deepEqual(
    sortEntries(entries, { key: 'size', descending: true }).map(e => e.name),
    ['folder', 'file10', 'file2', 'unknown']
  )
  assert.deepEqual(
    sortEntries(entries, { key: 'size', descending: false }).map(e => e.name),
    ['folder', 'file2', 'file10', 'unknown']
  )
  assert.deepEqual(
    sortEntries(entries, { key: 'modifiedAt', descending: true }).map(e => e.name),
    ['folder', 'file2', 'file10', 'unknown']
  )
  assert.equal(entries[0].name, 'file10')
})

test('timestamps show local date and minute, with a fallback for unavailable metadata', () => {
  assert.equal(formatModified(new Date(2026, 10, 6, 9, 5).getTime()), '2026-11-06 09:05')
  assert.equal(formatModified(null), '—')
  assert.equal(formatModified(NaN), '—')
})
