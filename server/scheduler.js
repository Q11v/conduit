import { posix } from 'node:path'

const overlaps = (a, b) => {
  if (a.scope !== b.scope || (a.read && b.read)) return false
  if (a.path.startsWith('~') || b.path.startsWith('~')) return true
  const x = posix.normalize(a.path).replace(/\/$/, '')
  const y = posix.normalize(b.path).replace(/\/$/, '')
  return x === y || x.startsWith(y + '/') || y.startsWith(x + '/')
}

const conflicts = (a, b) => a.some(x => b.some(y => overlaps(x, y)))

export function createScheduler(limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('并发数必须为正整数')
  const queue = []
  const active = new Set()

  function drain() {
    for (let i = 0; i < queue.length && active.size < limit;) {
      const entry = queue[i]
      if (
        [...active].some(x => conflicts(x.resources, entry.resources)) ||
        queue.slice(0, i).some(x => conflicts(x.resources, entry.resources))
      ) {
        i++
        continue
      }
      queue.splice(i, 1)
      active.add(entry)
      Promise.resolve()
        .then(entry.run)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          active.delete(entry)
          drain()
        })
    }
    for (const entry of queue) {
      const blocked = [...active, ...queue.slice(0, queue.indexOf(entry))].some(x =>
        conflicts(x.resources, entry.resources)
      )
      entry.onWait?.(blocked ? '等待相同目标的任务完成' : '等待传输空位')
    }
  }

  return {
    enqueue(resources, run, onWait) {
      let entry
      const promise = new Promise((resolve, reject) => {
        entry = { resources, run, onWait, resolve, reject }
        queue.push(entry)
      })
      promise.cancel = () => {
        const index = queue.indexOf(entry)
        if (index < 0) return
        queue.splice(index, 1)
        entry.reject(new Error('已取消'))
        drain()
      }
      drain()
      return promise
    }
  }
}
