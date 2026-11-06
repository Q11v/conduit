export type Notice = { id: number; message: string; tone: 'error' | 'info' }
let notices: Notice[] = []
let nextId = 0
const listeners = new Set<() => void>()
const publish = () => listeners.forEach(listener => listener())
export function notify(message: string, tone: Notice['tone'] = 'info') {
  if (!message || notices.some(item => item.message === message && item.tone === tone)) return
  notices = [...notices, { id: ++nextId, message, tone }].slice(-3)
  publish()
}
export const notifyError = (message: string) => notify(message, 'error')
export function dismissNotice(id: number) {
  notices = notices.filter(item => item.id !== id)
  publish()
}
export function clearNotices() {
  notices = []
  publish()
}
export const getNotices = () => notices
export const subscribeNotices = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
