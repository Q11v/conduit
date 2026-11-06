import { test, mock, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = await mkdtemp(join(tmpdir(), 'conduit-servers-test-'))
process.env.CONDUIT_CONFIG = join(dir, 'servers.json')
mock.module('./secrets.js', {
  namedExports: {
    keychainAvailable: false,
    setPassword: async () => {},
    getPassword: async () => null,
    deletePassword: async () => {}
  }
})
const { addServer, updateServer, removeServer, loadServers, reorderServers } = await import('./servers.js')
beforeEach(() => writeFile(process.env.CONDUIT_CONFIG, '[]'))
after(() => rm(dir, { recursive: true, force: true }))
const input = name => ({ name, host: `${name}.invalid`, dirs: ['/app'], tags: ['test'], auth: 'key', port: 2222 })

test('saved server order is returned by list reads without changing server configuration', async () => {
  const a = await addServer(input('a'))
  const b = await addServer(input('b'))
  const c = await addServer(input('c'))
  await reorderServers([c.id, a.id, b.id])
  assert.deepEqual(await loadServers(), [c, a, b])
  await reorderServers([b.id, 'missing', c.id, b.id])
  assert.deepEqual(await loadServers(), [b, a, c])
})

test('concurrent reordering, adding and editing do not overwrite each other', async () => {
  const a = await addServer(input('a'))
  const b = await addServer(input('b'))
  const [, c] = await Promise.all([
    reorderServers([b.id, a.id]),
    addServer(input('c')),
    updateServer(a.id, { name: 'edited' })
  ])
  const list = await loadServers()
  assert.deepEqual(
    list.map(s => s.id),
    [b.id, a.id, c.id]
  )
  assert.equal(list.find(s => s.id === a.id).name, 'edited')
  await Promise.all([removeServer(b.id), reorderServers([a.id, b.id, c.id])])
  assert.deepEqual(
    (await loadServers()).map(s => s.id),
    [a.id, c.id]
  )
})

test('invalid ordering leaves the configuration intact and does not block later edits', async () => {
  const a = await addServer(input('a'))
  await assert.rejects(reorderServers('invalid'), /ids 必须是数组/)
  assert.deepEqual(await loadServers(), [a])
  await updateServer(a.id, { name: 'after rejection' })
  assert.equal((await loadServers())[0].name, 'after rejection')
})

test('legacy directory, group and string port remain compatible without dropping configuration', async () => {
  await writeFile(
    process.env.CONDUIT_CONFIG,
    JSON.stringify([{ id: 'legacy', host: 'host.invalid', dir: '/app', group: 'test', port: '2222' }])
  )
  assert.deepEqual(await loadServers(), [
    {
      id: 'legacy',
      host: 'host.invalid',
      name: 'host.invalid',
      auth: 'key',
      dirs: ['/app'],
      tags: ['test'],
      port: 2222
    }
  ])
})
