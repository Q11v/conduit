import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJson, writeJson, replaceFiles } from './json-store.js'
import { configureEnvironment } from '../electron/environment.js'

const dir = await mkdtemp(join(tmpdir(), 'conduit-storage-'))
after(() => rm(dir, { recursive: true, force: true }))

test('corrupt configuration is never silently replaced and the last good backup survives', async () => {
  const file = join(dir, 'data.json')
  await writeJson(file, ['first'], Array.isArray)
  await writeJson(file, ['second'], Array.isArray)
  assert.deepEqual(JSON.parse(await readFile(file + '.bak', 'utf8')), ['first'])
  await writeFile(file, '{broken')
  await assert.rejects(readJson(file, Array.isArray, []), /无法读取配置/)
  await assert.rejects(writeJson(file, ['third'], Array.isArray), /无法读取配置/)
  assert.equal(await readFile(file, 'utf8'), '{broken')
  assert.deepEqual(JSON.parse(await readFile(file + '.bak', 'utf8')), ['first'])
  await replaceFiles([[file, ['first']]])
  assert.deepEqual(await readJson(file, Array.isArray, []), ['first'])
  assert.ok((await readdir(dir)).some(name => name.startsWith('data.json.before-restore-')))
})

test('wrong JSON shapes and unreadable files are not treated as empty configurations', async () => {
  const file = join(dir, 'shape.json')
  await writeFile(file, '{}')
  await assert.rejects(readJson(file, Array.isArray, []))
  await assert.rejects(readJson(dir, Array.isArray, []))
  assert.deepEqual(await readJson(join(dir, 'missing.json'), Array.isArray, []), [])
})

test('development isolates files, log directory and keychain namespace while respecting overrides', () => {
  const prod = configureEnvironment({}, '/fixture', 'darwin')
  const dev = configureEnvironment({ CONDUIT_DEV_URL: 'http://localhost:5173' }, '/fixture', 'darwin')
  for (const key of [
    'CONDUIT_DATA_DIR',
    'CONDUIT_CONFIG',
    'CONDUIT_PRESETS',
    'CONDUIT_SETTINGS',
    'CONDUIT_LOG_DIR',
    'CONDUIT_KEYCHAIN_SERVICE'
  ])
    assert.notEqual(prod[key], dev[key])
  assert.equal(prod.CONDUIT_CONFIG, '/fixture/.config/conduit/servers.json')
  const custom = configureEnvironment(
    { CONDUIT_DEV_URL: 'dev', CONDUIT_CONFIG: '/custom/servers.json' },
    '/fixture',
    'darwin'
  )
  assert.equal(custom.CONDUIT_CONFIG, '/custom/servers.json')
})
