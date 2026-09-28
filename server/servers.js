import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setPassword, getPassword, deletePassword, keychainAvailable } from './secrets.js'

export const CONFIG_PATH = process.env.CONDUIT_CONFIG || join(homedir(), '.config', 'conduit', 'servers.json')

export async function loadServers() {
  try {
    const parsed = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(s => {
        if (!s?.host) return null
        const dirs = Array.isArray(s.dirs)
          ? s.dirs.filter(d => typeof d === 'string' && d.trim())
          : typeof s.dir === 'string' && s.dir.trim()
            ? [s.dir.trim()]
            : []
        if (dirs.length === 0) return null
        const { dir, group, ...rest } = s
        const tags = cleanTags(Array.isArray(s.tags) ? s.tags : group ? [group] : [])
        return { ...rest, dirs: [...new Set(dirs)], tags }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

async function persist(list) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true })
  const tmp = `${CONFIG_PATH}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8')
  await rename(tmp, CONFIG_PATH)
}

function cleanTags(raw) {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(t => String(t ?? '').trim()).filter(Boolean))]
}

function clean(input) {
  const name = String(input.name ?? '').trim()
  const host = String(input.host ?? '').trim()
  const tags = cleanTags(input.tags)
  const auth = input.auth === 'password' ? 'password' : 'key'

  const raw = Array.isArray(input.dirs) ? input.dirs : input.dir ? [input.dir] : []
  const dirs = [...new Set(raw.map(d => String(d ?? '').trim()).filter(Boolean))]

  if (!host) throw new Error('主机不能为空')
  if (dirs.length === 0) throw new Error('至少要填一个常用目录')
  if (host.includes(':')) throw new Error('主机里不要带冒号和路径，端口填端口格，目录填目录格')
  for (const d of dirs) {
    if (!d.startsWith('/') && !d.startsWith('~')) {
      throw new Error(`常用目录请用绝对路径或 ~ 开头：${d}`)
    }
  }

  let port
  if (input.port !== undefined && input.port !== null && String(input.port).trim() !== '') {
    port = Number(input.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口应是 1–65535 的整数')
  }

  for (const t of tags) {
    if (t.length > 20) throw new Error(`标签太长（最多 20 个字）：${t}`)
    if (/[,，]/.test(t)) throw new Error(`标签里不要带逗号：${t}`)
  }

  if (auth === 'password' && !keychainAvailable) {
    throw new Error('密码认证依赖 macOS 钥匙串，当前系统不支持')
  }
  return { name: name || host, host, dirs, tags, auth, ...(port ? { port } : {}) }
}

export async function withSecret(server) {
  if (server.auth !== 'password') return server
  const password = await getPassword(server.id)
  if (password === null) {
    throw new Error('钥匙串里没有该服务器的密码 —— 编辑服务器重新填一次')
  }
  return { ...server, password }
}

export async function addServer(input) {
  const list = await loadServers()
  const server = { id: randomUUID(), ...clean(input) }
  if (server.auth === 'password') {
    if (!input.password) throw new Error('选了密码认证就必须填密码')
    await setPassword(server.id, input.password)
  }
  list.push(server)
  await persist(list)
  return server
}

export async function updateServer(id, input) {
  const list = await loadServers()
  const i = list.findIndex(s => s.id === id)
  if (i === -1) throw new Error('服务器不存在')

  const next = { ...list[i], ...clean({ ...list[i], ...input }) }
  if (input.port !== undefined && !next.port) delete next.port

  if (next.auth === 'password') {
    if (input.password) await setPassword(id, input.password)
    else if ((await getPassword(id)) === null) throw new Error('钥匙串里还没有密码，请填一次')
  } else if (list[i].auth === 'password') {
    await deletePassword(id)
  }

  list[i] = next
  await persist(list)
  return next
}

export async function removeServer(id) {
  const list = await loadServers()
  const target = list.find(s => s.id === id)
  if (!target) throw new Error('服务器不存在')
  if (target.auth === 'password') await deletePassword(id)
  await persist(list.filter(s => s.id !== id))
}
