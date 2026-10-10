import {
  appendFile,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const LOG_DIR =
  process.env.CONDUIT_LOG_DIR ||
  (process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Logs', 'conduit')
    : join(homedir(), '.local', 'state', 'conduit'))
export const LOG_FILE = join(LOG_DIR, 'conduit.log')
const EVENTS_FILE = join(LOG_DIR, 'activity.jsonl')

const LOG_MAX = 5 * 1024 * 1024
const KEEP = 1000

try {
  mkdirSync(LOG_DIR, { recursive: true })
} catch {}

const pad = (n, w = 2) => String(n).padStart(w, '0')
const stamp = () => new Date().toTimeString().slice(0, 8)
const fullStamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toTimeString().slice(0, 8)}.${pad(d.getMilliseconds(), 3)}`
const clock = (d = new Date()) => `${d.toTimeString().slice(0, 8)}.${pad(d.getMilliseconds(), 3)}`

let file = null
let written = 0

function openLog() {
  try {
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > LOG_MAX) renameSync(LOG_FILE, `${LOG_FILE}.1`)
    written = existsSync(LOG_FILE) ? statSync(LOG_FILE).size : 0
    file = createWriteStream(LOG_FILE, { flags: 'a' })
    file.on('error', () => (file = null))
  } catch {
    file = null
  }
}
openLog()

function toFile(level, tag, msg) {
  if (!file) return
  const body = String(msg).replace(/\n/g, '\n    ')
  const line = `${fullStamp()} ${level} ${tag} ${body}\n`
  file.write(line)
  written += Buffer.byteLength(line)
  if (written > LOG_MAX) {
    file.end()
    openLog()
  }
}

const text = rest => rest.map(x => (x instanceof Error ? x.stack || x.message : String(x))).join(' ')

export const log = (tag, ...rest) => {
  console.log(`[${stamp()}] ${tag}`, ...rest)
  toFile('INFO', tag, text(rest))
}
export const fail = (tag, ...rest) => {
  console.error(`[${stamp()}] ${tag}`, ...rest)
  toFile('ERROR', tag, text(rest))
}

export function note(trace, tag, line, bad = false) {
  ;(bad ? fail : log)(tag, line)
  trace?.push(`${clock()}  ${line}`)
}

export const quoteCmd = (cmd, args) =>
  [cmd, ...args.map(a => (/[\s'"$`\\*?]/.test(a) ? `'${a.replaceAll("'", `'\\''`)}'` : a))].join(' ')

export const oneLine = (s, max = 200) => {
  const t = String(s).replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

function loadEvents() {
  try {
    const lines = readFileSync(EVENTS_FILE, 'utf8').split('\n').filter(Boolean)
    const out = []
    for (const l of lines.slice(-KEEP)) {
      try {
        out.push(JSON.parse(l))
      } catch {}
    }
    if (lines.length > KEEP * 2) writeFileSync(EVENTS_FILE, out.map(e => JSON.stringify(e)).join('\n') + '\n')
    return out
  } catch {
    return []
  }
}

const events = loadEvents()

export function event(level, msg, detail) {
  const e = { t: new Date().toISOString(), level, msg: oneLine(msg, 300) }
  const d = Array.isArray(detail) ? detail.join('\n') : detail
  if (d) e.detail = String(d).slice(0, 20000)
  events.push(e)
  if (events.length > KEEP) events.shift()
  toFile('EVENT', level, d ? `${e.msg}\n${d}` : e.msg)
  appendFile(EVENTS_FILE, JSON.stringify(e) + '\n', () => {})
}

export const recentEvents = (limit = 100) => events.slice(-Math.max(1, Math.min(limit, KEEP))).reverse()
