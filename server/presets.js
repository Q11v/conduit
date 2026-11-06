import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parseTarget, cleanPullPaths, checkLocalDir } from './targets.js'

export const PRESETS_PATH = process.env.CONDUIT_PRESETS || join(homedir(), '.config', 'conduit', 'presets.json')

function normalizeTarget(t) {
  if (typeof t === 'string') return t ? { serverId: t, dir: null } : null
  if (t && typeof t.serverId === 'string' && t.serverId) {
    return { serverId: t.serverId, dir: typeof t.dir === 'string' && t.dir ? t.dir : null }
  }
  return null
}

export async function loadPresets() {
  try {
    const parsed = JSON.parse(await readFile(PRESETS_PATH, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(p => p?.id && p?.name)
      .map(p => {
        const lastRun = typeof p.lastRun === 'string' ? p.lastRun : null
        if (p.kind === 'pull') {
          return {
            id: p.id,
            name: p.name,
            kind: 'pull',
            serverId: typeof p.serverId === 'string' ? p.serverId : '',
            paths: Array.isArray(p.paths) ? p.paths.filter(x => typeof x === 'string' && x) : [],
            localDir: typeof p.localDir === 'string' ? p.localDir : '',
            lastRun
          }
        }
        return {
          id: p.id,
          name: p.name,
          kind: 'push',
          src: typeof p.src === 'string' ? p.src : '',
          targets: Array.isArray(p.targets) ? p.targets.map(normalizeTarget).filter(Boolean) : [],
          adhoc: Array.isArray(p.adhoc) ? p.adhoc.filter(x => typeof x === 'string') : [],
          lastRun
        }
      })
  } catch {
    return []
  }
}

async function persist(list) {
  await mkdir(dirname(PRESETS_PATH), { recursive: true })
  const tmp = `${PRESETS_PATH}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8')
  await rename(tmp, PRESETS_PATH)
}

function clean(input) {
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('方案名不能为空')

  if (input.kind === 'pull') {
    const serverId = String(input.serverId ?? '').trim()
    if (!serverId) throw new Error('拉取方案要选一台服务器')
    return { name, kind: 'pull', serverId, paths: cleanPullPaths(input.paths), localDir: checkLocalDir(input.localDir) }
  }

  const src = String(input.src ?? '').trim()
  const seen = new Set()
  const targets = []
  for (const raw of Array.isArray(input.targets) ? input.targets : []) {
    const t = normalizeTarget(raw)
    if (!t) continue
    const key = `${t.serverId}|${t.dir ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push(t)
  }
  const adhoc = Array.isArray(input.adhoc) ? input.adhoc.map(x => String(x).trim()).filter(Boolean) : []

  for (const spec of adhoc) parseTarget(spec)

  if (targets.length === 0 && adhoc.length === 0) throw new Error('方案至少要记住一个目标')
  return { name, kind: 'push', src, targets, adhoc }
}

let pendingWrite = Promise.resolve()
function mutate(change) {
  const operation = pendingWrite.then(async () => {
    const list = await loadPresets()
    const result = change(list)
    await persist(list)
    return result
  })
  pendingWrite = operation.catch(() => {})
  return operation
}

export function addPreset(input) {
  return mutate(list => {
    const preset = { id: randomUUID(), ...clean(input), lastRun: null }
    list.push(preset)
    return preset
  })
}

export function updatePreset(id, input) {
  return mutate(list => {
    const index = list.findIndex(p => p.id === id)
    if (index < 0) throw new Error('方案不存在')
    const preset = { id: list[index].id, ...clean(input), lastRun: list[index].lastRun }
    list[index] = preset
    return preset
  })
}

export function removePreset(id) {
  return mutate(list => {
    const index = list.findIndex(p => p.id === id)
    if (index < 0) throw new Error('方案不存在')
    list.splice(index, 1)
  })
}

export function touchPreset(id) {
  return mutate(list => {
    const preset = list.find(p => p.id === id)
    if (preset) preset.lastRun = new Date().toISOString()
  })
}

// 只重排给出的这些 id：它们原来占的位置按新顺序填回去，推送/拉取两类互不影响
export function reorderPresets(ids) {
  return mutate(list => {
    if (!Array.isArray(ids)) throw new Error('ids 必须是数组')
    const byId = new Map(list.map(p => [p.id, p]))
    const order = [...new Set(ids)].filter(id => byId.has(id))
    const wanted = new Set(order)
    let k = 0
    const reordered = list.map(p => (wanted.has(p.id) ? byId.get(order[k++]) : p))
    list.splice(0, list.length, ...reordered)
  })
}
