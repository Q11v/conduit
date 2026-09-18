import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import SSHConfig from 'ssh-config'

export function parseTarget(raw) {
  const spec = raw.trim()
  if (!spec) throw new Error('目标为空')

  const at = spec.indexOf('@')
  const colon = spec.indexOf(':', at + 1)
  if (colon === -1) throw new Error(`缺少冒号，应为 host:/path 格式：${spec}`)

  const host = spec.slice(0, colon)
  const dir = spec.slice(colon + 1)
  if (!host) throw new Error(`缺少主机名：${spec}`)
  if (!dir) throw new Error(`缺少远程目录：${spec}`)
  if (!dir.startsWith('/') && !dir.startsWith('~')) {
    throw new Error(`远程目录请用绝对路径或 ~ 开头：${spec}`)
  }
  return { spec, host, dir }
}

export function cleanPullPaths(raw) {
  const list = [...new Set((Array.isArray(raw) ? raw : []).map(p => String(p ?? '').trim()).filter(Boolean))]
  if (list.length === 0) throw new Error('至少选一个远端路径')
  const seen = new Map()
  for (const p of list) {
    if (!p.startsWith('/') && !p.startsWith('~')) throw new Error(`远端路径请用绝对路径或 ~ 开头：${p}`)
    const name = basename(p) || 'root'
    if (seen.has(name)) throw new Error(`${seen.get(name)} 和 ${p} 同名，会落到同一个本地路径，请分两次拉`)
    seen.set(name, p)
  }
  return list
}

export function checkLocalDir(raw) {
  const dir = String(raw ?? '').trim()
  if (!dir.startsWith('/') && !dir.startsWith('~')) throw new Error('本地目录请用绝对路径或 ~ 开头')
  return dir
}

export function sshConfigHosts() {
  const path = join(homedir(), '.ssh', 'config')
  if (!existsSync(path)) return []
  try {
    const parsed = SSHConfig.parse(readFileSync(path, 'utf8'))
    const names = new Set()
    for (const line of parsed) {
      if (line.param !== 'Host') continue
      const values = Array.isArray(line.value) ? line.value : [line.value]
      for (const v of values) {
        const name = typeof v === 'string' ? v : v?.val
        if (name && !name.includes('*') && !name.includes('?')) names.add(name)
      }
    }
    return [...names].sort()
  } catch {
    return []
  }
}
