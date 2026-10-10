export type Auth = 'key' | 'password'

export interface Server {
  id: string
  name: string
  host: string
  dirs: string[]
  tags: string[]
  auth: Auth
  port?: number
}

export const targetKey = (serverId: string, dir: string) => `${serverId}|${dir}`

export const splitKey = (key: string) => {
  const i = key.indexOf('|')
  return { serverId: key.slice(0, i), dir: key.slice(i + 1) }
}

export interface SelectedTarget {
  key: string
  server: Server
  dir: string
}

export type Probe = 'idle' | 'testing' | 'ok' | 'fail'

export interface CheckVerdict {
  ok: boolean
  reason: string
  at: number
}

export type Check = 'testing' | CheckVerdict

export type TargetStatus = 'pending' | 'running' | 'done' | 'error'

export type JobKind = 'push' | 'pull'

export interface JobTarget {
  key: string
  spec: string
  label: string
  dir: string
  status: TargetStatus
  percent?: number
  speed?: string
  eta?: string
  error?: string | null
  remoteDir?: string
  localPath?: string
}

export interface JobSnapshot {
  id: string
  kind: JobKind
  sourceName: string
  size: number | null
  localDir?: string
  targets: JobTarget[]
  done: boolean
}

export interface HostsInfo {
  hosts: string[]
  configPath: string
  presetsPath: string
  home: string
  keychain: boolean
  parallel: number
  logFile: string
}

export interface RemoteEntry {
  name: string
  type: 'dir' | 'file'
  size: number | null
}

export interface Listing {
  path: string
  select: string | null
  entries: RemoteEntry[]
  truncated: boolean
}

export interface ServerDraft {
  name: string
  tags: string[]
  host: string
  port: string
  dirs: string[]
  auth: Auth
  password: string
}

export const emptyDraft = (): ServerDraft => ({
  name: '',
  tags: [],
  host: '',
  port: '',
  dirs: [],
  auth: 'key',
  password: ''
})

export interface PresetTarget {
  serverId: string
  dir: string | null
}

export interface PushPreset {
  id: string
  name: string
  kind: 'push'
  src: string
  targets: PresetTarget[]
  adhoc: string[]
  lastRun: string | null
}

export interface PullPreset {
  id: string
  name: string
  kind: 'pull'
  serverId: string
  paths: string[]
  localDir: string
  lastRun: string | null
}

export type Preset = PushPreset | PullPreset

export type PresetInput =
  | Pick<PushPreset, 'kind' | 'name' | 'src' | 'targets' | 'adhoc'>
  | Pick<PullPreset, 'kind' | 'name' | 'serverId' | 'paths' | 'localDir'>

export type LogLevel = 'PUT' | 'GET' | 'OK' | 'FAIL' | 'TEST' | string

export interface ActivityEvent {
  t: string
  level: LogLevel
  msg: string
  detail?: string
}
