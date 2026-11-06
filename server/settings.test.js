import { test, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const dir = await mkdtemp(join(tmpdir(), 'conduit-settings-'))
process.env.CONDUIT_DATA_DIR = dir
process.env.CONDUIT_CONFIG = join(dir, 'servers.json')
process.env.CONDUIT_PRESETS = join(dir, 'presets.json')
process.env.CONDUIT_SETTINGS = join(dir, 'settings.json')
mock.module('./secrets.js', {
  namedExports: {
    keychainAvailable: true,
    getPassword: async () => null,
    setPassword: async () => {},
    deletePassword: async () => {}
  }
})
const { migrateSettings, loadSettings, updateSettings } = await import('./settings.js')
const { addServer } = await import('./servers.js')
const { addPreset } = await import('./presets.js')
const { exportBackup, restoreBackup, repairFromBackups } = await import('./backup.js')
after(() => rm(dir, { recursive: true, force: true }))
const bookmark = { id: 'b', name: 'app', local: '/tmp/app', remote: '/app', serverId: 's' }

test('legacy bookmarks migrate once and persist independently of a browser origin', async () => {
  const migrated = await migrateSettings({ bookmarks: [bookmark], localFavorites: ['/tmp'] })
  assert.deepEqual(migrated.bookmarks, [bookmark])
  await updateSettings({ localDirectory: '/other' })
  const again = await migrateSettings({ bookmarks: [], localFavorites: [] })
  assert.deepEqual(again.bookmarks, [bookmark])
  assert.equal((await loadSettings()).localDirectory, '/other')
  await Promise.all([updateSettings({ remoteDirectory: '/remote' }), updateSettings({ view: 'plans' })])
  const final = await loadSettings()
  assert.equal(final.remoteDirectory, '/remote')
  assert.equal(final.view, 'plans')
})

test('backup round-trip restores data, omits secrets and repairs only corrupted files', async () => {
  const server = await addServer({ name: 'app', host: 'host.invalid', auth: 'key', dirs: ['/app'] })
  await addPreset({ kind: 'push', name: 'deploy', src: '/tmp/app', targets: [{ serverId: server.id, dir: '/app' }] })
  const backup = await exportBackup()
  assert.equal('password' in backup.servers[0], false)
  const raw = JSON.parse(await readFile(process.env.CONDUIT_CONFIG, 'utf8'))
  raw[0].password = 'must-not-export'
  await writeFile(process.env.CONDUIT_CONFIG, JSON.stringify(raw))
  assert.equal(JSON.stringify(await exportBackup()).includes('must-not-export'), false)
  await updateSettings({ bookmarks: [] })
  await restoreBackup(backup)
  assert.deepEqual((await loadSettings()).bookmarks, [bookmark])
  assert.throws(() => restoreBackup({ ...backup, settings: {} }), /有效的 conduit 备份/)
  const before = await loadSettings()
  await updateSettings({ localDirectory: '/new' })
  await writeFile(process.env.CONDUIT_SETTINGS, 'broken')
  await assert.rejects(loadSettings())
  await assert.rejects(updateSettings({ view: 'log' }))
  assert.equal(await readFile(process.env.CONDUIT_SETTINGS, 'utf8'), 'broken')
  assert.deepEqual(await repairFromBackups(), [process.env.CONDUIT_SETTINGS])
  assert.deepEqual(await loadSettings(), before)
})

test('old settings and backups default to dark; light choice persists and restores', async () => {
  const old = await loadSettings()
  delete old.theme
  await writeFile(process.env.CONDUIT_SETTINGS, JSON.stringify(old))
  assert.equal((await loadSettings()).theme, 'dark')
  await updateSettings({ theme: 'light' })
  assert.equal((await loadSettings()).theme, 'light')
  const backup = await exportBackup()
  await updateSettings({ theme: 'dark' })
  await restoreBackup(backup)
  assert.equal((await loadSettings()).theme, 'light')
  await assert.rejects(updateSettings({ theme: 'invalid' }))
  assert.equal((await loadSettings()).theme, 'light')
})
