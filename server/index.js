import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { readFile, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, extname, join, dirname, isAbsolute, resolve, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTarget, sshConfigHosts, sshEndpoint, cleanPullPaths, checkLocalDir } from './targets.js'
import { pushOne, pullOne, checkTarget, browseRemote, deleteRemote } from './transfer.js'
import {
  loadServers,
  addServer,
  updateServer,
  removeServer,
  reorderServers,
  withSecret,
  CONFIG_PATH
} from './servers.js'
import { keychainAvailable } from './secrets.js'
import {
  loadPresets,
  addPreset,
  updatePreset,
  removePreset,
  reorderPresets,
  touchPreset,
  PRESETS_PATH
} from './presets.js'
import { log, fail, event, recentEvents, LOG_FILE } from './log.js'
import { validateDeletePaths } from './file-actions.js'
import { SETTINGS_PATH } from './settings.js'
import { createScheduler } from './scheduler.js'
import { createJobRunner } from './job-runner.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'web', 'dist')
const MAX_PARALLEL = Math.max(1, Math.min(16, Math.floor(Number(process.env.CONDUIT_PARALLEL) || 4)))

const scheduler = createScheduler(MAX_PARALLEL)
const jobs = new Map()
const taskListeners = new Set()
let restoring = false
let fileOperations = 0
let pendingOperations = 0

const expandHome = p => (p === '~' ? homedir() : p.startsWith('~/') ? join(homedir(), p.slice(2)) : p)

const humanSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

async function resolveTargets(raw) {
  const servers = await loadServers()
  const out = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = parseTarget(item)
      out.push({ key: t.spec, spec: t.spec, label: t.spec, host: t.host, dir: t.dir, auth: 'key' })
    } else {
      const s = servers.find(x => x.id === item.serverId)
      if (!s) throw new Error(`服务器不存在: ${item.serverId}`)
      const dir = String(item.dir || s.dirs[0] || '').trim()
      if (!dir.startsWith('/') && !dir.startsWith('~'))
        throw new Error(`${s.name} 的目标目录要用绝对路径或 ~ 开头：${dir}`)
      const conn = await withSecret(s)
      out.push({
        key: `${s.id}|${dir}`,
        spec: `${s.host}:${dir}`,
        label: s.name,
        host: s.host,
        dir,
        auth: s.auth,
        port: s.port,
        password: conn.password
      })
    }
  }
  return out
}

const snapshot = job => ({
  id: job.id,
  kind: job.kind,
  sourceName: job.sourceName,
  presetId: job.presetId,
  title: job.title,
  createdAt: job.createdAt,
  revision: job.revision || 0,
  size: job.size,
  localDir: job.localDir,
  targets: [...job.targets.values()].map(
    ({ key, spec, label, dir, status, percent, speed, eta, error, remoteDir, localPath, waiting }) => ({
      key,
      spec,
      label,
      dir,
      status,
      percent,
      speed,
      eta,
      error,
      remoteDir,
      localPath,
      waiting
    })
  ),
  done: [...job.targets.values()].every(t => t.status === 'done' || t.status === 'error')
})

function publish(job) {
  job.revision = (job.revision || 0) + 1
  const data = snapshot(job)
  for (const listener of job.listeners) listener(data)
  for (const listener of taskListeners) listener(data)
}

function startTask(job, t, onProgress) {
  const conn = { host: t.host, auth: t.auth, port: t.port, password: t.password, trace: t.trace, onProgress }
  return job.kind === 'pull'
    ? pullOne({ ...conn, remotePath: t.dir, localDir: job.localDir })
    : pushOne({ ...conn, source: job.source, dir: t.dir, verify: job.verify })
}

const { runJob, cancelJob } = createJobRunner({
  parallel: MAX_PARALLEL,
  scheduler,
  startTask,
  publish,
  event,
  resourcesFor: (job, t) => {
    const remote = {
      scope: `remote:${sshEndpoint(t.host, t.port)}`,
      path: posix.normalize(t.dir),
      read: job.kind === 'pull'
    }
    return job.kind === 'pull'
      ? [remote, { scope: 'local', path: resolve(job.localDir) }]
      : [remote, { scope: 'local', path: resolve(job.source), read: true }]
  }
})

const activePreset = id => id && [...jobs.values()].some(job => job.presetId === id && !snapshot(job).done)

async function jobMeta(presetId) {
  const preset = presetId ? (await loadPresets()).find(p => p.id === presetId) : null
  return { presetId: presetId || null, title: preset?.name || null, createdAt: new Date().toISOString() }
}

export const app = new Hono()

app.use('*', async (c, next) => {
  const started = Date.now()
  await next()
  if (c.req.path.startsWith('/api') && !(c.req.path === '/api/activity' && c.res.ok)) {
    log('http', `${c.req.method} ${c.req.path} → ${c.res.status} ${Date.now() - started}ms`)
  }
})

app.use('/api/*', async (c, next) => {
  const mutatingTask =
    c.req.method === 'POST' &&
    (/^\/api\/(jobs|pulls)$/.test(c.req.path) ||
      c.req.path === '/api/files/delete' ||
      /^\/api\/jobs\/[^/]+\/retry$/.test(c.req.path))
  if (!mutatingTask) return next()
  if (restoring) return c.json({ error: '正在恢复配置，请稍后重试' }, 409)
  pendingOperations++
  try {
    await next()
  } finally {
    pendingOperations--
  }
})

app.notFound(c => {
  fail('http', `404 ${c.req.method} ${c.req.path}`)
  return c.json(
    {
      error: `接口不存在：${c.req.method} ${c.req.path}`,
      hint: '服务端可能是旧版本进程，改完服务端代码需要重启 App'
    },
    404
  )
})

app.onError((err, c) => {
  fail('http', `500 ${c.req.method} ${c.req.path} → ${err.stack || err.message}`)
  return c.json({ error: err.message }, 500)
})

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
}

app.get('/assets/*', async c => {
  const name = basename(c.req.path)
  try {
    const buf = await readFile(join(DIST, 'assets', name))
    return c.body(buf, 200, {
      'content-type': MIME[extname(name)] || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable'
    })
  } catch {
    return c.notFound()
  }
})

app.get('/', async c => {
  try {
    return c.html(await readFile(join(DIST, 'index.html'), 'utf8'))
  } catch {
    fail('http', `前端未构建：${DIST} 不存在`)
    return c.html(
      '<meta charset="utf-8"><body style="font:14px ui-monospace,monospace;padding:40px;line-height:1.7">' +
        '前端还没构建。<br><br>跑一次 <b>npm run build</b>，或者直接用 <b>npm start</b>（会先构建再启动）。' +
        '<br><br>开发时用 <b>npm run dev</b>，前端在 5173 带热更新。</body>',
      500
    )
  }
})

app.get('/api/hosts', c =>
  c.json({
    hosts: sshConfigHosts(),
    configPath: CONFIG_PATH,
    presetsPath: PRESETS_PATH,
    settingsPath: SETTINGS_PATH,
    home: homedir(),
    keychain: keychainAvailable,
    logFile: LOG_FILE,
    parallel: MAX_PARALLEL
  })
)

app.get('/api/servers', async c => c.json({ servers: await loadServers() }))

app.post('/api/servers', async c => {
  try {
    return c.json(await addServer(await c.req.json()))
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

app.put('/api/servers/order', async c => {
  try {
    await reorderServers((await c.req.json()).ids)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

app.put('/api/servers/:id', async c => {
  try {
    return c.json(await updateServer(c.req.param('id'), await c.req.json()))
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

app.delete('/api/servers/:id', async c => {
  try {
    await removeServer(c.req.param('id'))
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: err.message }, 404)
  }
})

app.get('/api/activity', c => c.json({ events: recentEvents(Number(c.req.query('limit')) || 100) }))

app.get('/api/presets', async c => c.json({ presets: await loadPresets() }))

app.post('/api/presets', async c => {
  try {
    return c.json(await addPreset(await c.req.json()))
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

app.put('/api/presets/order', async c => {
  try {
    await reorderPresets((await c.req.json()).ids)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

app.put('/api/presets/:id', async c => {
  try {
    return c.json(await updatePreset(c.req.param('id'), await c.req.json()))
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
})

app.delete('/api/presets/:id', async c => {
  try {
    await removePreset(c.req.param('id'))
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: err.message }, 404)
  }
})

app.post('/api/check', async c => {
  try {
    const body = await c.req.json()
    let conn
    if (body.serverId) {
      const s = (await loadServers()).find(x => x.id === body.serverId)
      if (!s) return c.json({ ok: false, reason: '服务器不存在' }, 404)
      conn = await withSecret(s)
    } else {
      if (!body.host) return c.json({ ok: false, reason: '缺少主机' }, 400)
      conn = body
    }
    conn = { ...conn, trace: [] }
    const verdict = await checkTarget(conn)
    event(verdict.ok ? 'TEST' : 'FAIL', `${conn.host} ${verdict.reason}`, conn.trace)
    return c.json(verdict)
  } catch (err) {
    return c.json({ ok: false, reason: err.message })
  }
})

app.post('/api/browse', async c => {
  try {
    const { serverId, path } = await c.req.json()
    const s = (await loadServers()).find(x => x.id === serverId)
    if (!s) return c.json({ ok: false, reason: '服务器不存在' }, 404)
    const p = String(path ?? '').trim() || '~'
    if (!p.startsWith('/') && !p.startsWith('~')) {
      return c.json({ ok: false, reason: '远端路径请用绝对路径或 ~ 开头' }, 400)
    }
    return c.json(await browseRemote(await withSecret(s), p))
  } catch (err) {
    return c.json({ ok: false, reason: err.message })
  }
})

app.post('/api/files/delete', async c => {
  try {
    const { serverId, directory, paths } = await c.req.json()
    const files = validateDeletePaths(directory, paths)
    const server = (await loadServers()).find(s => s.id === serverId)
    if (!server) return c.json({ ok: false, reason: '服务器不存在' }, 404)
    const conn = { ...(await withSecret(server)), trace: [] }
    if (restoring) return c.json({ reason: '正在恢复配置，请稍后重试' }, 409)
    fileOperations++
    let result
    try {
      result = await scheduler.enqueue(
        files.map(path => ({ scope: `remote:${sshEndpoint(server.host, server.port)}`, path })),
        () => deleteRemote(conn, directory, files)
      )
    } finally {
      fileOperations--
    }
    event(
      result.ok ? 'DELETE' : 'FAIL',
      `${server.host} 删除 ${files.length} 项${result.ok ? '完成' : '失败'}`,
      conn.trace
    )
    return c.json(result, result.ok ? 200 : 400)
  } catch (err) {
    return c.json({ ok: false, reason: err.message }, 400)
  }
})

app.get('/api/jobs', c => c.json({ jobs: [...jobs.values()].map(snapshot) }))

app.get('/api/jobs/events', c =>
  streamSSE(c, async stream => {
    let finish
    const finished = new Promise(resolve => {
      finish = resolve
    })
    const push = data => {
      void stream.writeSSE({ data: JSON.stringify(data) }).catch(finish)
    }
    taskListeners.add(push)
    stream.onAbort(finish)
    for (const job of jobs.values()) push(snapshot(job))
    try {
      await finished
    } finally {
      taskListeners.delete(push)
    }
  })
)

app.post('/api/jobs', async c => {
  if (restoring) return c.json({ error: '正在恢复配置，请稍后重试' }, 409)
  const { source: rawSource, targets, presetId, verify } = await c.req.json()
  const source = expandHome(String(rawSource || '').trim())
  if (!source) return c.json({ error: '缺少 source' }, 400)
  if (!Array.isArray(targets) || targets.length === 0) {
    return c.json({ error: '至少选一个目标' }, 400)
  }

  let size
  try {
    size = (await stat(source)).size
  } catch {
    return c.json({ error: `本地路径不存在: ${source}` }, 400)
  }

  let resolved
  try {
    resolved = await resolveTargets(targets)
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }

  const meta = await jobMeta(presetId)
  if (activePreset(presetId)) return c.json({ error: '这个方案已有任务在进行中' }, 409)
  if (restoring) return c.json({ error: '正在恢复配置，请稍后重试' }, 409)
  const job = {
    ...meta,
    id: randomUUID(),
    kind: 'push',
    source,
    sourceName: basename(source),
    size,
    targets: new Map(resolved.map(t => [t.key, { ...t, status: 'pending', percent: 0 }])),
    listeners: new Set(),
    running: new Map(),
    verify: !!verify,
    cancelled: false
  }
  jobs.set(job.id, job)
  event('PUT', `${job.sourceName} (${humanSize(size)}) → ${resolved.length} 台`, [
    `来源 ${source}`,
    ...resolved.map(t => `目标 ${t.label} ${t.spec}`),
    ...(job.verify ? ['推送后校验大小'] : [])
  ])
  if (presetId) touchPreset(presetId).catch(err => fail('presets', err.message))
  void runJob(job, [...job.targets.keys()])
  return c.json({ id: job.id, job: snapshot(job) })
})

app.post('/api/pulls', async c => {
  if (restoring) return c.json({ error: '正在恢复配置，请稍后重试' }, 409)
  const { serverId, paths, localDir, presetId } = await c.req.json()
  const s = (await loadServers()).find(x => x.id === serverId)
  if (!s) return c.json({ error: `服务器不存在: ${serverId}` }, 400)

  let list, dest
  try {
    list = cleanPullPaths(paths)
    dest = expandHome(checkLocalDir(localDir))
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }
  if (!isAbsolute(dest)) return c.json({ error: '本地目录请用绝对路径或 ~ 开头' }, 400)

  let conn
  try {
    conn = await withSecret(s)
  } catch (err) {
    return c.json({ error: err.message }, 400)
  }

  const meta = await jobMeta(presetId)
  if (activePreset(presetId)) return c.json({ error: '这个方案已有任务在进行中' }, 409)
  if (restoring) return c.json({ error: '正在恢复配置，请稍后重试' }, 409)
  const job = {
    ...meta,
    id: randomUUID(),
    kind: 'pull',
    sourceName: s.name,
    size: null,
    localDir: dest,
    targets: new Map(
      list.map(p => [
        p,
        {
          key: p,
          spec: `${s.host}:${p}`,
          label: s.name,
          host: s.host,
          dir: p,
          auth: s.auth,
          port: s.port,
          password: conn.password,
          status: 'pending',
          percent: 0
        }
      ])
    ),
    listeners: new Set(),
    running: new Map(),
    cancelled: false
  }
  jobs.set(job.id, job)
  event('GET', `${s.name} ${list.length} 项 → ${dest}`, [
    `服务器 ${s.name} (${s.host})`,
    `本地 ${dest}`,
    ...list.map(p => `远端 ${p}`)
  ])
  if (presetId) touchPreset(presetId).catch(err => fail('presets', err.message))
  void runJob(job, [...job.targets.keys()])
  return c.json({ id: job.id, job: snapshot(job) })
})

app.post('/api/jobs/:id/retry', async c => {
  const job = jobs.get(c.req.param('id'))
  if (!job) return c.json({ error: '任务不存在' }, 404)
  if (!snapshot(job).done) return c.json({ error: '任务还在进行中' }, 409)
  if (activePreset(job.presetId)) return c.json({ error: '这个方案已有任务在进行中' }, 409)
  const failed = [...job.targets.values()].filter(t => t.status === 'error').map(t => t.key)
  if (failed.length === 0) return c.json({ error: '没有失败的目标' }, 400)
  event(job.kind === 'pull' ? 'GET' : 'PUT', `重试 ${failed.length} 个失败${job.kind === 'pull' ? '项' : '目标'}`)
  job.cancelled = false
  void runJob(job, failed)
  return c.json({ retrying: failed, job: snapshot(job) })
})

app.post('/api/jobs/:id/cancel', c => {
  const job = jobs.get(c.req.param('id'))
  if (!job) return c.json({ error: '任务不存在' }, 404)
  const running = [...job.running.values()]
  cancelJob(job)
  event('WARN', `已取消${job.kind === 'pull' ? '拉取' : '推送'}，${running.length} 个传输中断`)
  return c.json({ cancelled: running.length })
})

app.get('/api/jobs/:id/events', c => {
  const job = jobs.get(c.req.param('id'))
  if (!job) return c.json({ error: '任务不存在' }, 404)

  return streamSSE(c, async stream => {
    let push
    const finished = new Promise(resolve => {
      push = data => {
        stream.writeSSE({ data: JSON.stringify(data) })
        if (data.done) resolve()
      }
    })
    job.listeners.add(push)
    push(snapshot(job))
    try {
      await Promise.race([finished, new Promise(r => stream.onAbort(r))])
    } finally {
      job.listeners.delete(push)
    }
  })
})

export async function withIdleTransfers(operation) {
  if (restoring || fileOperations || pendingOperations || [...jobs.values()].some(job => !snapshot(job).done))
    throw new Error('请先完成传输和文件操作，再恢复配置')
  restoring = true
  try {
    return await operation()
  } finally {
    restoring = false
  }
}

export async function trashLocalFiles(files, trashItem) {
  if (restoring) throw new Error('正在恢复配置，请稍后重试')
  fileOperations++
  try {
    return await scheduler.enqueue(
      files.map(path => ({ scope: 'local', path: resolve(path) })),
      async () => {
        const deleted = [],
          errors = []
        for (const file of files) {
          try {
            await trashItem(file)
            deleted.push(file)
          } catch (err) {
            errors.push(`${file}: ${err.message}`)
          }
        }
        event(errors.length ? 'FAIL' : 'DELETE', `本地移到废纸篓 ${deleted.length}/${files.length} 项`, errors)
        return errors.length ? { ok: false, deleted, error: errors.join('\n') } : { ok: true, deleted }
      }
    )
  } finally {
    fileOperations--
  }
}

export function start(port) {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, info => {
      console.log(`conduit → http://127.0.0.1:${info.port}  (仅监听本机)`)
      console.log(`服务器配置：${CONFIG_PATH}`)
      resolve(info.port)
    })
    server.once('error', reject)
  })
}
