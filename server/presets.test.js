import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = await mkdtemp(join(tmpdir(), 'conduit-presets-test-'))
process.env.CONDUIT_PRESETS = join(dir, 'presets.json')
const { addPreset, touchPreset, loadPresets, removePreset, reorderPresets } = await import('./presets.js')
after(() => rm(dir, { recursive: true, force: true }))

test('simultaneous task timestamps and preset edits do not overwrite each other', async () => {
  const input = name => ({ name, kind: 'push', src: '/tmp/app', targets: [{ serverId: 'a', dir: '/app' }] })
  const [a, b] = await Promise.all([addPreset(input('a')), addPreset(input('b'))])
  assert.equal((await loadPresets()).length, 2)
  await Promise.all([touchPreset(a.id), touchPreset(b.id), addPreset(input('c'))])
  const all = await loadPresets()
  assert.equal(all.length, 3)
  assert.ok(all.find(p => p.id === a.id).lastRun)
  assert.ok(all.find(p => p.id === b.id).lastRun)
  const c = all.find(p => p.name === 'c')
  await Promise.all([removePreset(a.id), reorderPresets([c.id, b.id]), touchPreset(c.id)])
  assert.deepEqual(
    (await loadPresets()).map(p => p.id),
    [c.id, b.id]
  )
})

test('a rejected edit does not block subsequent updates', async () => {
  await assert.rejects(removePreset('does-not-exist'), /方案不存在/)
  const p = await addPreset({ name: 'after rejection', kind: 'push', targets: [{ serverId: 'a', dir: '/app' }] })
  assert.ok((await loadPresets()).some(item => item.id === p.id))
})
