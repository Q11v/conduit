const stamp = () => new Date().toTimeString().slice(0, 8)

export const log = (tag, ...rest) => console.log(`[${stamp()}] ${tag}`, ...rest)
export const fail = (tag, ...rest) => console.error(`[${stamp()}] ${tag}`, ...rest)

export const quoteCmd = (cmd, args) =>
  [cmd, ...args.map(a => (/[\s'"$`\\*?]/.test(a) ? `'${a.replaceAll("'", `'\\''`)}'` : a))].join(' ')

export const oneLine = (s, max = 200) => {
  const t = String(s).replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

const RING = 200
const events = []

export function event(level, msg) {
  events.push({ t: new Date().toISOString(), level, msg: oneLine(msg, 300) })
  if (events.length > RING) events.shift()
}

export const recentEvents = (limit = 100) => events.slice(-Math.max(1, Math.min(limit, RING))).reverse()
