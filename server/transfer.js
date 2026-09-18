import { spawn } from 'node:child_process'
import { stat, chmod, readdir, mkdir } from 'node:fs/promises'
import { basename, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { log, fail, quoteCmd, oneLine } from './log.js'

const CMD_TIMEOUT = Number(process.env.CONDUIT_TIMEOUT || 30) * 1000

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ASKPASS = join(ROOT, 'bin', 'askpass.sh')

chmod(ASKPASS, 0o755).catch(() => {})

function shellQuote(path) {
  const quote = s => `'${s.replaceAll("'", `'\\''`)}'`
  if (path === '~') return '~'
  if (path.startsWith('~/')) return '~/' + quote(path.slice(2))
  return quote(path)
}

function sshOpts({ auth, port }) {
  const opts = ['-o', 'ConnectTimeout=15']
  if (port) opts.push('-p', String(port))
  if (auth === 'password') {
    opts.push(
      '-o',
      'BatchMode=no',
      '-o',
      'PubkeyAuthentication=no',
      '-o',
      'PreferredAuthentications=password,keyboard-interactive',
      '-o',
      'NumberOfPasswordPrompts=1'
    )
  } else {
    opts.push('-o', 'BatchMode=yes')
  }
  return opts
}

function sshEnv({ auth, password }) {
  if (auth !== 'password') return process.env
  return {
    ...process.env,
    SSH_ASKPASS: ASKPASS,
    SSH_ASKPASS_REQUIRE: 'force',
    CONDUIT_PASSWORD: password ?? ''
  }
}

function explain(stderr, code, auth) {
  const msg = stderr.trim()
  if (code === -2) {
    return `超时 ${CMD_TIMEOUT / 1000}s 无响应，已终止 — 常见原因：主机名解析卡住、端口不是 sshd、防火墙静默丢包`
  }
  if (/host key verification failed/i.test(msg)) {
    return '主机密钥未确认 — 先在终端手动 ssh 一次确认指纹，之后本工具才会连'
  }
  if (/permission denied|authentication failed/i.test(msg)) {
    return auth === 'password'
      ? '密码错误，或服务器不允许密码登录'
      : 'SSH 认证失败 — 试试 ssh-add，或在 ~/.ssh/config 里配 IdentityFile'
  }
  if (/could not resolve|name or service not known|nodename nor servname/i.test(msg)) return '主机名无法解析'
  if (/connection refused|timed out|no route to host/i.test(msg)) return '连不上（端口不通或主机离线）'
  return msg || `退出码 ${code}`
}

function run(cmd, args, env, tag = 'ssh', onChild) {
  return new Promise(resolve => {
    const started = Date.now()
    log(tag, quoteCmd(cmd, args))

    const child = spawn(cmd, args, { env })
    onChild?.(child)
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      fail(tag, `超时 ${CMD_TIMEOUT / 1000}s，终止进程 pid=${child.pid}`)
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2000).unref()
    }, CMD_TIMEOUT)

    child.stdout.on('data', d => {
      stdout += d
    })
    child.stderr.on('data', d => {
      stderr += d
    })
    child.on('error', err => {
      clearTimeout(timer)
      fail(tag, `启动失败: ${err.message}`)
      resolve({ code: -1, stdout, stderr: err.message })
    })
    child.on('close', code => {
      clearTimeout(timer)
      const ms = Date.now() - started
      if (timedOut) return resolve({ code: -2, stdout, stderr: 'timeout' })
      log(tag, `exit=${code} ${ms}ms${stderr.trim() ? ` stderr: ${oneLine(stderr)}` : ''}`)
      resolve({ code, stdout, stderr })
    })

    child.stdin.end()
  })
}

async function ensureRemoteDir(conn, dir, onChild) {
  const q = shellQuote(dir)
  const { code, stdout, stderr } = await run(
    'ssh',
    [...sshOpts(conn), conn.host, `mkdir -p -- ${q} && cd -- ${q} && pwd`],
    sshEnv(conn),
    `mkdir ${conn.host}`,
    onChild
  )
  if (code !== 0) throw new Error(`无法准备远程目录: ${explain(stderr, code, conn.auth)}`)
  const abs = stdout.trim().split('\n').pop()
  if (!abs) throw new Error('远程目录路径解析失败')
  return abs
}

const PROGRESS_RE = /(\d[\d,]*)\s+(\d{1,3})%\s+(\S+)\s+(\d+:\d\d:\d\d)/

async function localSize(path) {
  const st = await stat(path)
  if (!st.isDirectory()) return st.size
  let total = 0
  for (const e of await readdir(path, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue
    total += await localSize(join(path, e.name))
  }
  return total
}

async function remoteSize(conn, remotePath) {
  const q = shellQuote(remotePath)
  const script =
    `if [ -d ${q} ]; then find ${q} -type f -exec ls -ln {} + 2>/dev/null | awk '{s+=$5} END {printf "%d", s+0}'; ` +
    `else ls -ln ${q} 2>/dev/null | awk '{printf "%d", $5}'; fi`
  const { code, stdout } = await run('ssh', [...sshOpts(conn), conn.host, script], sshEnv(conn), `verify ${conn.host}`)
  if (code !== 0) return null
  const n = Number(stdout.trim())
  return Number.isFinite(n) ? n : null
}

const rsyncBase = conn => [
  '-a',
  '-s',
  '--partial',
  '--info=progress2',
  '--no-inc-recursive',
  '-e',
  `ssh ${sshOpts(conn).join(' ')}`
]

function rsync(args, conn, tag, onProgress, onChild) {
  log(tag, quoteCmd('rsync', args))
  return new Promise((resolve, reject) => {
    const child = spawn('rsync', args, { env: sshEnv(conn) })
    onChild(child)
    child.stdin.end()
    let stderr = ''
    let buffer = ''

    child.stdout.on('data', chunk => {
      buffer += chunk.toString()
      const parts = buffer.split(/[\r\n]/)
      buffer = parts.pop()
      for (const line of parts) {
        const m = PROGRESS_RE.exec(line)
        if (m) {
          onProgress({
            percent: Number(m[2]),
            transferred: Number(m[1].replaceAll(',', '')),
            speed: m[3],
            eta: m[4]
          })
        }
      }
    })

    child.stderr.on('data', d => {
      stderr += d
    })
    child.on('error', err => {
      fail(tag, `启动失败: ${err.message}`)
      reject(new Error(`启动 rsync 失败: ${err.message}`))
    })
    child.on('close', code => resolve({ code, stderr }))
  })
}

function rsyncError(tag, code, stderr, ms, cancelled, auth) {
  if (cancelled) {
    log(tag, `已取消 ${ms}ms`)
    return new Error('已取消')
  }
  fail(tag, `exit=${code} ${ms}ms stderr: ${oneLine(stderr)}`)
  return new Error(explain(stderr, code, auth))
}

export function pushOne({ source, verify = false, onProgress = () => {}, ...conn }) {
  let child = null
  let cancelled = false

  const promise = (async () => {
    try {
      await stat(source)
      const absDir = await ensureRemoteDir(conn, conn.dir, c => {
        child = c
      })
      child = null
      if (cancelled) throw new Error('已取消')

      const tag = `rsync ${conn.host}`
      const started = Date.now()
      const { code, stderr } = await rsync(
        [...rsyncBase(conn), source, `${conn.host}:${absDir}/`],
        conn,
        tag,
        onProgress,
        c => {
          child = c
        }
      )
      const ms = Date.now() - started
      if (code !== 0) throw rsyncError(tag, code, stderr, ms, cancelled, conn.auth)

      log(tag, `完成 ${ms}ms → ${absDir}`)
      if (!verify) return { remoteDir: absDir }
      const [local, remote] = await Promise.all([localSize(source), remoteSize(conn, `${absDir}/${basename(source)}`)])
      if (remote === null) {
        log(tag, '校验跳过：读不到远端大小')
        return { remoteDir: absDir, verified: null }
      }
      if (remote !== local) throw new Error(`校验不一致：本地 ${local} 字节，远端 ${remote} 字节`)
      log(tag, `校验通过 ${local} 字节`)
      return { remoteDir: absDir, verified: local }
    } catch (err) {
      if (cancelled) throw new Error('已取消', { cause: err })
      throw err
    }
  })()

  promise.cancel = () => {
    cancelled = true
    child?.kill('SIGTERM')
  }
  return promise
}

async function statRemote(conn, path, onChild) {
  const q = shellQuote(path)
  const script =
    `if [ -d ${q} ]; then echo T=dir; cd -- ${q} && pwd; ` +
    `elif [ -e ${q} ]; then echo T=file; cd -- "$(dirname -- ${q})" && printf '%s/%s\\n' "$(pwd)" "$(basename -- ${q})"; ` +
    'else echo T=missing; fi'
  const { code, stdout, stderr } = await run(
    'ssh',
    [...sshOpts(conn), conn.host, script],
    sshEnv(conn),
    `stat ${conn.host}`,
    onChild
  )
  if (code !== 0) throw new Error(`无法读取远端路径: ${explain(stderr, code, conn.auth)}`)
  const type = (/^T=(\w+)$/m.exec(stdout) || [])[1]
  if (type === 'missing') throw new Error(`远端路径不存在: ${path}`)
  const abs = stdout.trim().split('\n').pop()?.replace(/^\/\//, '/')
  if ((type !== 'dir' && type !== 'file') || !abs?.startsWith('/')) throw new Error('远端路径解析失败')
  return { type, path: abs }
}

export function pullOne({ remotePath, localDir, onProgress = () => {}, ...conn }) {
  let child = null
  let cancelled = false

  const promise = (async () => {
    try {
      const remote = await statRemote(conn, remotePath, c => {
        child = c
      })
      child = null
      if (cancelled) throw new Error('已取消')

      const name = basename(remote.path) || 'root'
      const localPath = join(localDir, name)
      const [from, to] =
        remote.type === 'dir' ? [`${remote.path.replace(/\/$/, '')}/`, localPath] : [remote.path, localDir]
      try {
        await mkdir(to, { recursive: true })
      } catch (err) {
        throw new Error(`无法创建本地目录 ${to}: ${err.message}`, { cause: err })
      }

      const tag = `rsync ${conn.host}`
      const started = Date.now()
      const { code, stderr } = await rsync(
        [...rsyncBase(conn), `${conn.host}:${from}`, `${to}/`],
        conn,
        tag,
        onProgress,
        c => {
          child = c
        }
      )
      const ms = Date.now() - started
      if (code !== 0) throw rsyncError(tag, code, stderr, ms, cancelled, conn.auth)
      log(tag, `完成 ${ms}ms → ${localPath}`)
      return { localPath }
    } catch (err) {
      if (cancelled) throw new Error('已取消', { cause: err })
      throw err
    }
  })()

  promise.cancel = () => {
    cancelled = true
    child?.kill('SIGTERM')
  }
  return promise
}

const BROWSE_LIMIT = 2000

export async function browseRemote(conn, path) {
  const q = shellQuote(path)
  const script = [
    `if [ -d ${q} ]; then cd -- ${q} || exit 0; echo SELECT=; ` +
      `elif [ -e ${q} ]; then echo "SELECT=$(basename -- ${q})"; cd -- "$(dirname -- ${q})" || exit 0; ` +
      'else echo MISSING; exit 0; fi',
    'echo "PWD=$(pwd)"',
    'echo ---',
    "if find . -maxdepth 0 -printf '' >/dev/null 2>&1; then " +
      "find . -mindepth 1 -maxdepth 1 -printf '%Y\\t%s\\t%f\\n' 2>/dev/null; " +
      'else for f in .* *; do case "$f" in .|..) continue ;; esac; [ -e "$f" ] || continue; ' +
      `if [ -d "$f" ]; then printf 'd\\t\\t%s\\n' "$f"; else printf 'f\\t\\t%s\\n' "$f"; fi; done; fi | head -n ${BROWSE_LIMIT + 1}`
  ].join('\n')

  const { code, stdout, stderr } = await run(
    'ssh',
    [...sshOpts(conn), conn.host, script],
    sshEnv(conn),
    `browse ${conn.host}`
  )
  if (code !== 0) return { ok: false, reason: explain(stderr, code, conn.auth) }
  if (/^MISSING$/m.test(stdout)) return { ok: false, reason: `路径不存在: ${path}` }

  const sep = stdout.indexOf('\n---\n')
  const cwd = (/^PWD=(.*)$/m.exec(stdout.slice(0, sep)) || [])[1]
  if (sep === -1 || !cwd) return { ok: false, reason: `进不去这个目录（多半是没有权限）: ${path}` }

  const entries = []
  for (const line of stdout.slice(sep + 5).split('\n')) {
    const a = line.indexOf('\t')
    const b = line.indexOf('\t', a + 1)
    if (a === -1 || b === -1) continue
    const kind = line.slice(0, a)
    const name = line.slice(b + 1)
    if (!name || (kind !== 'd' && kind !== 'f')) continue
    const size = line.slice(a + 1, b)
    entries.push({ name, type: kind === 'd' ? 'dir' : 'file', size: kind === 'f' && size ? Number(size) : null })
  }
  const truncated = entries.length > BROWSE_LIMIT
  entries.splice(BROWSE_LIMIT)
  entries.sort((x, y) => (x.type === y.type ? 0 : x.type === 'dir' ? -1 : 1) || x.name.localeCompare(y.name))

  const picked = (/^SELECT=(.*)$/m.exec(stdout) || [])[1]
  const select = picked ? (cwd === '/' ? `/${picked}` : `${cwd}/${picked}`) : null
  return { ok: true, path: cwd, select, entries, truncated }
}

export async function checkTarget(conn) {
  const dirs = (Array.isArray(conn.dirs) ? conn.dirs : [conn.dir]).filter(Boolean)
  const lines = ['command -v rsync >/dev/null 2>&1 && echo RSYNC=yes || echo RSYNC=no']
  dirs.forEach((d, i) => {
    const q = shellQuote(d)
    lines.push(
      `if [ -d ${q} ]; then [ -w ${q} ] && echo D${i}=writable || echo D${i}=readonly; ` + `else echo D${i}=missing; fi`
    )
  })

  const { code, stdout, stderr } = await run(
    'ssh',
    [...sshOpts(conn), conn.host, lines.join('\n')],
    sshEnv(conn),
    `check ${conn.host}`
  )

  if (code !== 0) {
    const reason = explain(stderr, code, conn.auth)
    log(`check ${conn.host}`, `判定 FAIL: ${reason}`)
    return { ok: false, reason, dirs: dirs.map(dir => ({ dir, ok: false, reason })) }
  }
  if (!/RSYNC=yes/.test(stdout)) {
    const reason = '连通，但远端没装 rsync'
    log(`check ${conn.host}`, `判定 FAIL: ${reason}`)
    return { ok: false, reason, dirs: dirs.map(dir => ({ dir, ok: false, reason })) }
  }

  const perDir = dirs.map((dir, i) => {
    const state = (new RegExp(`D${i}=(\\w+)`).exec(stdout) || [])[1]
    if (state === 'writable') return { dir, ok: true, state, reason: '目录可写' }
    if (state === 'missing') return { dir, ok: true, state, reason: '目录不存在，推送时会自动创建' }
    if (state === 'readonly') return { dir, ok: false, state, reason: '目录存在但当前用户不可写' }
    return { dir, ok: false, state: 'unknown', reason: '目录状态未知' }
  })

  const bad = perDir.filter(d => !d.ok)
  const verdict = {
    ok: bad.length === 0,
    reason: bad.length === 0 ? `连通 · ${perDir.length} 个目录就绪` : `连通，但 ${bad.length} 个目录不可写`,
    dirs: perDir
  }
  log(`check ${conn.host}`, `判定 ${verdict.ok ? 'OK' : 'FAIL'}: ${verdict.reason}`)
  return verdict
}
