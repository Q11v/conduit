import { join } from 'node:path'
import { homedir } from 'node:os'
import { readJson, writeJson, withDataLock } from './json-store.js'

export const SETTINGS_PATH =
  process.env.CONDUIT_SETTINGS ||
  join(process.env.CONDUIT_DATA_DIR || join(homedir(), '.config', 'conduit'), 'settings.json')
export const DEFAULT_SETTINGS = {
  bookmarks: [],
  localFavorites: ['~/Downloads', '~/Desktop', '~/Documents'],
  localDirectory: '~/Downloads',
  remoteDirectory: '~',
  remoteServerId: '',
  view: 'workbench',
  theme: 'dark',
  legacyImported: false
}
export const isBookmark = b =>
  b && ['id', 'name', 'local', 'remote', 'serverId'].every(key => typeof b[key] === 'string')
export const isSettings = value =>
  value &&
  typeof value === 'object' &&
  Array.isArray(value.bookmarks) &&
  value.bookmarks.every(isBookmark) &&
  Array.isArray(value.localFavorites) &&
  value.localFavorites.every(p => typeof p === 'string') &&
  ['localDirectory', 'remoteDirectory', 'remoteServerId'].every(key => typeof value[key] === 'string') &&
  ['workbench', 'plans', 'log'].includes(value.view) &&
  typeof value.legacyImported === 'boolean' &&
  (value.theme === undefined || ['dark', 'light'].includes(value.theme))

export const loadSettings = async () => ({
  ...DEFAULT_SETTINGS,
  ...(await readJson(SETTINGS_PATH, isSettings, DEFAULT_SETTINGS))
})
export function updateSettings(patch) {
  return withDataLock(async () => {
    const current = await loadSettings()
    const allowed = Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS)
        .filter(key => key in patch && key !== 'legacyImported')
        .map(key => [key, patch[key]])
    )
    const next = { ...current, ...allowed, legacyImported: true }
    if (!isSettings(next)) throw new Error('书签或工作台设置格式不正确')
    await writeJson(SETTINGS_PATH, next, isSettings)
    return next
  })
}

export function migrateSettings(legacy = {}) {
  return withDataLock(async () => {
    const current = await loadSettings()
    if (current.legacyImported || !Object.keys(legacy).length) return current
    const next = { ...current, ...legacy, legacyImported: true }
    if (!isSettings(next)) throw new Error('旧版书签格式不正确，未修改原数据')
    await writeJson(SETTINGS_PATH, next, isSettings)
    return next
  })
}
