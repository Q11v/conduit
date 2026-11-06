import { CONFIG_PATH, loadServers, isServerData } from './servers.js'
import { PRESETS_PATH, loadPresets, isPresetData } from './presets.js'
import { SETTINGS_PATH, loadSettings, isSettings } from './settings.js'
import { readJson, replaceFiles, withDataLock } from './json-store.js'

const isServer = s =>
  s &&
  ['id', 'name', 'host'].every(k => typeof s[k] === 'string') &&
  s.host &&
  ['key', 'password'].includes(s.auth) &&
  ['dirs', 'tags'].every(k => Array.isArray(s[k]) && s[k].every(v => typeof v === 'string')) &&
  (s.port === undefined || (Number.isInteger(s.port) && s.port >= 1 && s.port <= 65535))
const isPreset = p =>
  p &&
  typeof p.id === 'string' &&
  typeof p.name === 'string' &&
  (p.kind === 'push'
    ? typeof p.src === 'string' &&
      Array.isArray(p.targets) &&
      p.targets.every(t => t && typeof t.serverId === 'string' && (t.dir === null || typeof t.dir === 'string')) &&
      Array.isArray(p.adhoc) &&
      p.adhoc.every(v => typeof v === 'string')
    : p.kind === 'pull' &&
      typeof p.serverId === 'string' &&
      typeof p.localDir === 'string' &&
      Array.isArray(p.paths) &&
      p.paths.every(v => typeof v === 'string'))
const serversValid = value => Array.isArray(value) && value.every(isServer)
const presetsValid = value => Array.isArray(value) && value.every(isPreset)
const files = [
  [CONFIG_PATH, isServerData],
  [PRESETS_PATH, isPresetData],
  [SETTINGS_PATH, isSettings]
]
const cleanServers = servers =>
  servers.map(s => ({
    id: s.id,
    name: s.name,
    host: s.host,
    dirs: s.dirs,
    tags: s.tags,
    auth: s.auth,
    ...(s.port ? { port: s.port } : {})
  }))

export function exportBackup() {
  return withDataLock(async () => ({
    format: 'conduit-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    servers: cleanServers(await loadServers()),
    presets: await loadPresets(),
    settings: await loadSettings()
  }))
}
export function validateBackup(input) {
  if (
    !input ||
    input.format !== 'conduit-backup' ||
    input.version !== 1 ||
    !serversValid(input.servers) ||
    !presetsValid(input.presets) ||
    !isSettings(input.settings)
  )
    throw new Error('不是有效的 conduit 备份文件，未修改现有配置')
  return { ...input, servers: cleanServers(input.servers) }
}
export function restoreBackup(input) {
  const backup = validateBackup(input)
  return withDataLock(async () => {
    await replaceFiles([
      [CONFIG_PATH, backup.servers],
      [PRESETS_PATH, backup.presets],
      [SETTINGS_PATH, { ...backup.settings, legacyImported: true }]
    ])
  })
}
export function repairFromBackups() {
  return withDataLock(async () => {
    const replacements = []
    for (const [file, validate] of files) {
      try {
        await readJson(file, validate, null)
      } catch {
        const backup = await readJson(`${file}.bak`, validate, null)
        if (!validate(backup)) throw new Error(`${file} 没有可用的自动备份，请导入手动备份`)
        replacements.push([file, backup])
      }
    }
    await replaceFiles(replacements)
    return replacements.map(([file]) => file)
  })
}
