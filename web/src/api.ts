import type {
  ActivityEvent,
  CheckVerdict,
  HostsInfo,
  JobSnapshot,
  Listing,
  Preset,
  PresetInput,
  Server,
  ServerDraft
} from './types'

export type Result<T> = ({ ok: true } & T) | ({ ok: false } & Partial<T> & { error?: string; reason?: string })

async function request<T>(url: string, body?: unknown, method = 'POST'): Promise<Result<T>> {
  let res: Response
  let text: string
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    text = await res.text()
  } catch (e) {
    return { ok: false, error: `连不上本地服务：${(e as Error).message}（npm start 还在跑吗？）` } as Result<T>
  }
  try {
    return { ok: res.ok, ...JSON.parse(text) }
  } catch {
    return {
      ok: false,
      error:
        res.status === 404
          ? `${url} 返回 404 —— 服务端多半是旧版本进程，重启 npm start 再试`
          : `服务端返回了非 JSON（HTTP ${res.status}）：${text.slice(0, 120)}`
    } as Result<T>
  }
}

export const why = (r: unknown) => {
  const o = r as { reason?: string; error?: string } | null
  return o?.reason || o?.error || '未知错误'
}

export const getHosts = () => request<HostsInfo>('/api/hosts', undefined, 'GET')

export const getServers = () => request<{ servers: Server[] }>('/api/servers', undefined, 'GET')

const payload = (d: ServerDraft) => ({
  name: d.name,
  tags: d.tags.map(t => t.trim()).filter(Boolean),
  host: d.host.trim(),
  port: d.port.trim(),
  dirs: d.dirs.map(x => x.trim()).filter(Boolean),
  auth: d.auth,
  ...(d.password ? { password: d.password } : {})
})

export const createServer = (d: ServerDraft) => request<Server>('/api/servers', payload(d))

export const saveServer = (id: string, d: ServerDraft) => request<Server>(`/api/servers/${id}`, payload(d), 'PUT')

export const deleteServer = (id: string) => request<{ ok: true }>(`/api/servers/${id}`, undefined, 'DELETE')

export const checkServer = (serverId: string) => request<CheckVerdict>('/api/check', { serverId })

export const checkDraft = (d: ServerDraft) => request<CheckVerdict>('/api/check', payload(d))

export type TargetRef = { serverId: string; dir: string } | string

export const startJob = (source: string, targets: TargetRef[], presetId?: string, verify = false) =>
  request<{ id: string }>('/api/jobs', { source, targets, presetId, verify })

export const browse = (serverId: string, path: string) => request<Listing>('/api/browse', { serverId, path })

export const startPull = (serverId: string, paths: string[], localDir: string, presetId?: string) =>
  request<{ id: string }>('/api/pulls', { serverId, paths, localDir, presetId })

export const revealJob = (id: string) => request<{ ok: true }>(`/api/jobs/${id}/reveal`)

export const cancelJob = (id: string) => request<{ cancelled: number }>(`/api/jobs/${id}/cancel`)

export const getActivity = () => request<{ events: ActivityEvent[] }>('/api/activity', undefined, 'GET')

export const getPresets = () => request<{ presets: Preset[] }>('/api/presets', undefined, 'GET')

export const createPreset = (p: PresetInput) => request<Preset>('/api/presets', p)

export const deletePreset = (id: string) => request<{ ok: true }>(`/api/presets/${id}`, undefined, 'DELETE')

export const retryJob = (id: string) => request<{ retrying: string[] }>(`/api/jobs/${id}/retry`)

export function upload(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ source: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name).replace(/%/g, '_'))
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status !== 200) return reject(new Error(xhr.responseText || `HTTP ${xhr.status}`))
      try {
        resolve(JSON.parse(xhr.responseText))
      } catch {
        reject(new Error('服务端返回了非 JSON'))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.send(file)
  })
}

export function subscribe(jobId: string, onSnapshot: (job: JobSnapshot) => void, onError: () => void): () => void {
  const es = new EventSource(`/api/jobs/${jobId}/events`)
  es.onmessage = e => {
    const job: JobSnapshot = JSON.parse(e.data)
    onSnapshot(job)
    if (job.done) es.close()
  }
  es.onerror = () => {
    es.close()
    onError()
  }
  return () => es.close()
}

// 拖入/选择的文件会先暂存到 <tmp>/conduit-staging/<uuid>/ 下，浏览器拿不到原路径
export const stagedName = (path: string) => path.match(/[\\/]conduit-staging[\\/][0-9a-f-]{36}[\\/]([^\\/]+)$/)?.[1] ?? null

export const formatSize = (n: number) => {
  if (!Number.isFinite(n)) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export function formatLastRun(iso: string | null, never = '尚未推送') {
  if (!iso) return never
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return never
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d.toDateString() === new Date().toDateString()) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
