import { test, mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, utimes, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Execute the generated remote command locally, without an SSH connection.
let fixture = null
mock.module('node:child_process', {
  namedExports: {
    spawn: (_cmd, args, options) =>
      fixture === null
        ? spawn('/bin/sh', ['-c', args.at(-1)], options)
        : spawn(process.execPath, ['-e', `process.stdout.write(${JSON.stringify(fixture)})`], options)
  }
})
mock.module('./log.js', { namedExports: { note: () => {}, quoteCmd: () => '' } })
const { browseRemote } = await import('./transfer.js')
const dir = await mkdtemp(join(tmpdir(), 'conduit-browse-'))
after(() => rm(dir, { recursive: true, force: true }))

test('directory browsing reports actual file sizes, modification times, and linked directories', async () => {
  const timestamp = new Date('2026-01-02T03:04:05Z')
  await mkdir(join(dir, 'folder'))
  await writeFile(join(dir, 'file with spaces'), '1234567')
  await writeFile(join(dir, 'empty'), '')
  await symlink(join(dir, 'folder'), join(dir, 'linked folder'))
  await utimes(join(dir, 'file with spaces'), timestamp, timestamp)
  const result = await browseRemote({ host: 'unused' }, dir)
  assert.equal(result.ok, true)
  const file = result.entries.find(e => e.name === 'file with spaces')
  assert.equal(file.size, 7)
  assert.equal(file.modifiedAt, timestamp.getTime())
  assert.equal(result.entries.find(e => e.name === 'empty').size, 0)
  assert.equal(result.entries.find(e => e.name === 'linked folder').type, 'dir')
  assert.equal(result.entries.find(e => e.name === 'folder').size, null)
})

test('GNU find metadata retains fractional timestamps and handles unavailable stat fields', async () => {
  fixture =
    'SELECT=\nPWD=/app\n---\nf\t0\t1700000000.125\tempty\nf\t\t\tunknown\nf\t15\t1700000001\tname\twith tab\nd\t4096\t1700000002\tfolder\n'
  const result = await browseRemote({ host: 'unused' }, '/app')
  assert.equal(result.ok, true)
  assert.equal(result.entries.find(e => e.name === 'empty').modifiedAt, 1700000000125)
  assert.equal(result.entries.find(e => e.name === 'unknown').modifiedAt, null)
  assert.equal(result.entries.find(e => e.name === 'unknown').size, null)
  assert.equal(result.entries.find(e => e.name === 'name\twith tab').size, 15)
  assert.equal(result.entries.find(e => e.name === 'folder').size, null)
})
