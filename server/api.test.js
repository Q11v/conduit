import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

const transfers = []
const deletions = []
const servers = [{ id: 'server', name: 'server', host: 'test.invalid', auth: 'key', dirs: ['/app'] }]
const presets = [
  { id: 'a', name: '方案 A' },
  { id: 'b', name: '方案 B' }
]
const noop = () => {}
const transfer = () => {
  let resolve, reject
  const task = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  task.cancel = () => reject(new Error('已取消'))
  transfers.push({ resolve, reject })
  return task
}
mock.module('./transfer.js', {
  namedExports: {
    pushOne: transfer,
    pullOne: transfer,
    checkTarget: noop,
    browseRemote: noop,
    deleteRemote: async (conn, directory, paths) => {
      deletions.push({ host: conn.host, directory, paths })
      return { ok: true, deleted: paths }
    }
  }
})
mock.module('./log.js', {
  namedExports: { log: noop, fail: noop, event: noop, recentEvents: () => [], LOG_FILE: '/unused/log' }
})
mock.module('./servers.js', {
  namedExports: {
    loadServers: async () => servers,
    addServer: noop,
    updateServer: noop,
    reorderServers: async ids => {
      if (!Array.isArray(ids)) throw new Error('ids 必须是数组')
      const order = new Map(ids.map((id, index) => [id, index]))
      servers.sort((a, b) => (order.get(a.id) ?? ids.length) - (order.get(b.id) ?? ids.length))
    },
    removeServer: noop,
    withSecret: async s => ({ ...s, password: 'secret-must-not-appear-in-snapshots' }),
    CONFIG_PATH: '/unused/servers'
  }
})
mock.module('./presets.js', {
  namedExports: {
    loadPresets: async () => presets,
    addPreset: noop,
    updatePreset: async (id, input) => ({ id, ...input }),
    removePreset: noop,
    reorderPresets: noop,
    touchPreset: async () => {},
    PRESETS_PATH: '/unused/presets'
  }
})
const { app } = await import('./index.js')
const post = (path, data) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
const start = (presetId, dir) =>
  post('/api/jobs', { source: process.execPath, presetId, targets: [{ serverId: 'server', dir }] })
const list = async () => (await (await app.request('/api/jobs')).json()).jobs
const flush = () => new Promise(resolve => setImmediate(resolve))

test('API supports separate presets, blocks duplicate starts, queues conflicts, and retries independently', async () => {
  const [firstResponse, duplicateResponse] = await Promise.all([start('a', '/app'), start('a', '/app')])
  assert.deepEqual([firstResponse.status, duplicateResponse.status].sort(), [200, 409])
  const first = await (firstResponse.status === 200 ? firstResponse : duplicateResponse).json()
  assert.equal(first.job.title, '方案 A')
  await flush()

  const secondResponse = await start('b', '/app/')
  assert.equal(secondResponse.status, 200)
  const second = await secondResponse.json()
  await flush()
  assert.equal(transfers.length, 1)
  const snapshots = await list()
  assert.equal(snapshots.find(j => j.id === second.id).targets[0].status, 'pending')
  assert.equal(JSON.stringify(snapshots).includes('secret-must-not-appear'), false)

  assert.equal((await post(`/api/jobs/${first.id}/retry`)).status, 409)
  await post(`/api/jobs/${second.id}/cancel`)
  await flush()
  assert.equal((await list()).find(j => j.id === second.id).targets[0].error, '已取消')

  const retry = await post(`/api/jobs/${second.id}/retry`)
  assert.equal(retry.status, 200)
  assert.equal((await start('b', '/elsewhere')).status, 409)
  assert.equal((await post(`/api/jobs/${second.id}/retry`)).status, 409)
  await flush()
  assert.equal(transfers.length, 1)
  transfers[0].resolve({ remoteDir: '/app' })
  await flush()
  assert.equal(transfers.length, 2)
  transfers[1].resolve({ remoteDir: '/app' })
  await flush()
  assert.ok((await list()).every(j => j.done))
})

test('push and pull can run together, and one cancellation does not affect the other', async () => {
  const before = transfers.length
  const push = await (await start('a', '/push')).json()
  const pullResponse = await post('/api/pulls', {
    serverId: 'server',
    paths: ['/pull'],
    localDir: '/tmp/conduit-test-output',
    presetId: 'b'
  })
  assert.equal(pullResponse.status, 200)
  const pull = await pullResponse.json()
  await flush()
  assert.equal(transfers.length, before + 2)
  await post(`/api/jobs/${push.id}/cancel`)
  await flush()
  assert.equal((await list()).find(j => j.id === pull.id).done, false)
  transfers[before + 1].resolve({ localPath: '/tmp/conduit-test-output/pull' })
  await flush()
  assert.equal((await list()).find(j => j.id === pull.id).done, true)
})

test(
  'one event stream carries progress for multiple jobs and reconnects with current snapshots',
  { timeout: 2000 },
  async () => {
    const response = await app.request('/api/jobs/events')
    assert.match(response.headers.get('content-type'), /text\/event-stream/)
    const reader = response.body.getReader()
    const before = transfers.length
    const a = await (await start('a', '/stream-a')).json()
    const b = await (await start('b', '/stream-b')).json()
    await flush()
    transfers[before].resolve({ remoteDir: '/stream-a' })
    transfers[before + 1].resolve({ remoteDir: '/stream-b' })
    await flush()
    const seen = new Set()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (seen.size < 2) {
        const { value, done } = await reader.read()
        assert.equal(done, false)
        buffer += decoder.decode(value, { stream: true })
        let boundary
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const data = frame.split('\n').find(line => line.startsWith('data:'))
          if (!data) continue
          const job = JSON.parse(data.slice(5))
          if ((job.id === a.id || job.id === b.id) && job.done) {
            assert.ok(job.revision > 1)
            seen.add(job.id)
          }
        }
      }
    } finally {
      await reader.cancel()
    }
    const reconnected = await app.request('/api/jobs/events')
    const reconnectReader = reconnected.body.getReader()
    const first = await reconnectReader.read()
    assert.match(new TextDecoder().decode(first.value), /"revision":/)
    await reconnectReader.cancel()
  }
)

test('preset edit endpoint returns the updated preset without creating a new identity', async () => {
  const response = await app.request('/api/presets/a', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'edited', kind: 'pull', serverId: 'server', paths: ['/app'], localDir: '/tmp' })
  })
  assert.equal(response.status, 200)
  const preset = await response.json()
  assert.equal(preset.id, 'a')
  assert.equal(preset.name, 'edited')
  assert.equal(preset.kind, 'pull')
})

test('server order route is not handled as editing a server named order', async () => {
  const response = await app.request('/api/servers/order', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: ['server'] })
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  const invalid = await app.request('/api/servers/order', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: 'invalid' })
  })
  assert.equal(invalid.status, 400)
})

test('file deletion checks directory boundaries and returns deleted paths', async () => {
  const invalid = await post('/api/files/delete', { serverId: 'server', directory: '/app', paths: ['/outside'] })
  assert.equal(invalid.status, 400)
  assert.equal(deletions.length, 0)
  const response = await post('/api/files/delete', { serverId: 'server', directory: '/app', paths: ['/app/old.txt'] })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, deleted: ['/app/old.txt'] })
  assert.deepEqual(deletions[0], { host: 'test.invalid', directory: '/app', paths: ['/app/old.txt'] })
})

test('file deletion is blocked while a transfer is active', async () => {
  const job = await (await start('a', '/delete-conflict')).json()
  const before = deletions.length
  const response = await post('/api/files/delete', { serverId: 'server', directory: '/app', paths: ['/app/old.txt'] })
  assert.equal(response.status, 409)
  assert.equal(deletions.length, before)
  await post(`/api/jobs/${job.id}/cancel`)
  await flush()
})
