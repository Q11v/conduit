import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { validateDeletePaths } from './file-actions.js'

const commands = []
mock.module('node:child_process', {
  namedExports: {
    spawn: (command, args, opts) => {
      commands.push({ command, args })
      // Inspect the SSH command without executing any deletion.
      return spawn(process.execPath, ['-e', 'process.exit(0)'], opts)
    }
  }
})
mock.module('./log.js', { namedExports: { note: () => {}, quoteCmd: () => '' } })
const { deleteRemote } = await import('./transfer.js')

test('delete validation permits only direct children and preserves literal file names', () => {
  assert.deepEqual(validateDeletePaths('/app', ['/app/a', '/app/a', '/app/ file ']), ['/app/a', '/app/ file '])
  for (const paths of [
    [],
    ['/'],
    ['/app'],
    ['/app/..'],
    ['/app/a/../b'],
    ['/app/child/nested'],
    ['/outside'],
    ['/app/link/'],
    ['/app/x\0'],
    ['relative'],
    [null]
  ]) {
    assert.throws(() => validateDeletePaths('/app', paths))
  }
  assert.throws(() => validateDeletePaths('~', ['/app/a']))
  assert.throws(() => validateDeletePaths('/app', 'not an array'))
})

test('remote deletion quotes literal names and does not dereference directory symlinks', async () => {
  const paths = ["/app/O'Brien $(whoami)", '/app/linked-folder']
  const result = await deleteRemote({ host: 'unused', port: 2222 }, '/app', paths)
  assert.deepEqual(result, { ok: true, deleted: paths })
  const command = commands.at(-1)
  assert.equal(command.command, 'ssh')
  assert.equal(command.args.at(-1), "rm -r -- '/app/O'\\''Brien $(whoami)' '/app/linked-folder'")
  assert.ok(command.args.includes('2222'))
  const before = commands.length
  await assert.rejects(deleteRemote({ host: 'unused' }, '/app', ['/app/..']))
  assert.equal(commands.length, before)
})
