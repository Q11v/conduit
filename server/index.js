import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { basename, extname, join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTarget, sshConfigHosts, cleanPullPaths, checkLocalDir } from './targets.js'
import { pushOne, pullOne, checkTarget, browseRemote } from './transfer.js'
import { loadServers, addServer, updateServer, removeServer, withSecret, CONFIG_PATH } from './servers.js'
import { keychainAvailable } from './secrets.js'
import { loadPresets, addPreset, removePreset, touchPreset, PRESETS_PATH } from './presets.js'
import { log, fail, event, recentEvents } from './log.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'web', 'dist')
const STAGING = join(tmpdir(), 'conduit-staging')
const PORT = Number(process.env.PORT || 4321)
const MAX_PARALLEL = Math.max(1, Math.min(16, Number(process.env.CONDUIT_PARALLEL) || 4))

const jobs = new Map()

const OPENER = { darwin: 'open', linux: 'xdg-open' }[process.platform]

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
  size: job.size,
  localDir: job.localDir,
  targets: [...job.targets.values()].map(
    ({ key, spec, label, dir, status, percent, speed, eta, error, remoteDir, localPath }) => ({
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
      localPath
    })
  ),
  done: [...job.targets.values()].every(t => t.status === 'done' || t.status === 'error')
})

function publish(job) {
  const data = snapshot(job)
  for (const listener of job.listeners) listener(data)
}

function startTask(job, t, onProgress) {
  const conn = { host: t.host, auth: t.auth, port: t.port, password: t.password, onProgress }
  return job.kind === 'pull'
    ? pullOne({ ...conn, remotePath: t.dir, localDir: job.localDir })
    : pushOne({ ...conn, source: job.source, dir: t.dir, verify: job.verify })
}

async function runJob(job, keys) {
  const queue = [...keys]
  const worker = async () => {
    while (queue.length) {
      const key = queue.shift()
      const t = job.targets.get(key)
      if (job.cancelled) {
        t.status = 'error'
        t.error = '已取消'
        publish(job)
        continue
      }
      t.status = 'running'
      t.percent = 0
      t.error = null
      publish(job)
      const started = Date.now()
      try {
        const task = startTask(job, t, p => {
          Object.assign(t, p)
          publish(job)
        })
        job.running.set(key, task)
        const { remoteDir, localPath } = await task
        t.status = 'done'
        t.percent = 100
        t.remoteDir = remoteDir
        t.localPath = localPath
        const secs = ((Date.now() - started) / 1000).toFixed(1)
        event(
          'OK',
          job.kind === 'pull'
            ? `${t.label} ${t.dir} 拉取完成，${secs}s → ${localPath}`
            : `${t.label} ${t.dir} 完成，${secs}s → ${remoteDir}`
        )
      } catch (err) {
        t.status = 'error'
        t.error = err.message
        event('FAIL', `${t.label} ${t.dir} ${err.message}`)
      } finally {
        job.running.delete(key)
        publish(job)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, worker))
}

const app = new Hono()

app.use('*', async (c, next) => {
  const started = Date.now()
  await next()
  if (c.req.path.startsWith('/api')) {
    log('http', `${c.req.method} ${c.req.path} → ${c.res.status} ${Date.now() - started}ms`)
  }
})

app.notFound(c => {
  fail('http', `404 ${c.req.method} ${c.req.path}`)
  return c.json(
    {
      error: `接口不存在：${c.req.method} ${c.req.path}`,
      hint: '服务端可能是旧版本进程，改完代码需要重启 npm start'
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
    home: homedir(),
    keychain: keychainAvailable,
    parallel: MAX_PARALLEL,
    reveal: !!OPENER
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
      const dirs = Array.isArray(body.dirs) ? body.dirs.filter(Boolean) : body.dir ? [body.dir] : []
      if (!body.host || dirs.length === 0) return c.json({ ok: false, reason: '缺少主机或目录' }, 400)
      body.dirs = dirs
      conn = body
    }
    const verdict = await checkTarget(conn)
    event(verdict.ok ? 'TEST' : 'FAIL', `${conn.host} ${verdict.reason}`)
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

app.post('/api/upload', async c => {
  const name = basename(c.req.header('x-filename') || 'upload.bin')
  const dir = join(STAGING, randomUUID())
  await mkdir(dir, { recursive: true })
  const dest = join(dir, name)
  if (!c.req.raw.body) return c.json({ error: '请求没有 body' }, 400)
  await pipeline(Readable.fromWeb(c.req.raw.body), createWriteStream(dest))
  const { size } = await stat(dest)
  return c.json({ source: dest, name, size })
})

app.post('/api/jobs', async c => {
  const { source, targets, presetId, verify } = await c.req.json()
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

  const job = {
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
  event('PUT', `${job.sourceName} (${humanSize(size)}) → ${resolved.length} 台`)
  if (presetId) touchPreset(presetId).catch(err => fail('presets', err.message))
  runJob(job, [...job.targets.keys()])
  return c.json({ id: job.id })
})

app.post('/api/pulls', async c => {
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

  const job = {
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
  event('GET', `${s.name} ${list.length} 项 → ${dest}`)
  if (presetId) touchPreset(presetId).catch(err => fail('presets', err.message))
  runJob(job, [...job.targets.keys()])
  return c.json({ id: job.id })
})

app.post('/api/jobs/:id/reveal', c => {
  const job = jobs.get(c.req.param('id'))
  if (!job?.localDir) return c.json({ error: '任务不存在或不是拉取任务' }, 404)
  if (!OPENER) return c.json({ error: '当前系统不支持打开目录' }, 400)
  spawn(OPENER, [job.localDir], { detached: true, stdio: 'ignore' })
    .on('error', err => fail('reveal', err.message))
    .unref()
  return c.json({ ok: true })
})

app.post('/api/jobs/:id/retry', async c => {
  const job = jobs.get(c.req.param('id'))
  if (!job) return c.json({ error: '任务不存在' }, 404)
  const failed = [...job.targets.values()].filter(t => t.status === 'error').map(t => t.key)
  if (failed.length === 0) return c.json({ error: '没有失败的目标' }, 400)
  event(job.kind === 'pull' ? 'GET' : 'PUT', `重试 ${failed.length} 个失败${job.kind === 'pull' ? '项' : '目标'}`)
  job.cancelled = false
  runJob(job, failed)
  return c.json({ retrying: failed })
})

app.post('/api/jobs/:id/cancel', c => {
  const job = jobs.get(c.req.param('id'))
  if (!job) return c.json({ error: '任务不存在' }, 404)
  job.cancelled = true
  const running = [...job.running.values()]
  for (const task of running) task.cancel()
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

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, () => {
  console.log(`conduit → http://127.0.0.1:${PORT}  (仅监听本机)`)
  console.log(`服务器配置：${CONFIG_PATH}`)
  if (!keychainAvailable) console.log('提示：非 macOS，密码认证不可用，请用 SSH 密钥')
})
