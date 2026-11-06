import type { RemoteEntry } from '../types'

export type SortKey = 'name' | 'size' | 'modifiedAt'
export type FileSort = { key: SortKey; descending: boolean }

export function sortEntries(entries: RemoteEntry[], sort: FileSort): RemoteEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    let compared: number
    if (sort.key === 'name') {
      compared = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    } else {
      const left = a[sort.key]
      const right = b[sort.key]
      const hasLeft = typeof left === 'number' && Number.isFinite(left)
      const hasRight = typeof right === 'number' && Number.isFinite(right)
      if (hasLeft !== hasRight) return hasLeft ? -1 : 1
      compared = hasLeft && hasRight ? left - right : 0
    }
    return compared ? compared * (sort.descending ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}

export function formatModified(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
