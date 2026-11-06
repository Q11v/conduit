import { join } from 'node:path'

export function configureEnvironment(env, home, platform = process.platform) {
  const dev = Boolean(env.CONDUIT_DEV_URL)
  const name = dev ? 'conduit-dev' : 'conduit'
  env.CONDUIT_DATA_DIR ||= join(home, '.config', name)
  env.CONDUIT_CONFIG ||= join(env.CONDUIT_DATA_DIR, 'servers.json')
  env.CONDUIT_PRESETS ||= join(env.CONDUIT_DATA_DIR, 'presets.json')
  env.CONDUIT_SETTINGS ||= join(env.CONDUIT_DATA_DIR, 'settings.json')
  env.CONDUIT_LOG_DIR ||=
    platform === 'darwin' ? join(home, 'Library', 'Logs', name) : join(home, '.local', 'state', name)
  env.CONDUIT_KEYCHAIN_SERVICE ||= name
  return env
}
