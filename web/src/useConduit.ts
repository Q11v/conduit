import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import { why } from './api'
import type {
  ActivityEvent,
  Check,
  HostsInfo,
  JobKind,
  JobSnapshot,
  Preset,
  Probe,
  PullPreset,
  PushPreset,
  SelectedTarget,
  Server,
  ServerDraft
} from './types'
import { emptyDraft, splitKey, targetKey } from './types'

export type View = 'push' | 'pull' | 'log' | 'servers'
export type FormMode = 'new' | (string & {}) | null

export interface Status {
  text: string
  bad: boolean
}

const PULL_DIR_KEY = 'conduit.pullDir'
const loadPullDir = () => {
  try {
    return localStorage.getItem(PULL_DIR_KEY) || '~/Downloads'
  } catch {
    return '~/Downloads'
  }
}

const VIEW_KEY = 'conduit.view'
const VIEWS: View[] = ['push', 'pull', 'log', 'servers']
const loadView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null
    return v && VIEWS.includes(v) ? v : 'servers'
  } catch {
    return 'servers'
  }
}

export function useConduit() {
  const [view, setView] = useState<View>(loadView)
  const [servers, setServers] = useState<Server[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const [hosts, setHosts] = useState<HostsInfo | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [form, setForm] = useState<FormMode>(null)
  const [draft, setDraft] = useState<ServerDraft>(emptyDraft())
  const [formMsg, setFormMsg] = useState<Status | null>(null)

  const [src, setSrc] = useState('')
  const [size, setSize] = useState<number | null>(null)
  const [staging, setStaging] = useState<{ name: string; pct: number } | null>(null)
  const [adhoc, setAdhoc] = useState('')

  const [presets, setPresets] = useState<Preset[]>([])
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null)
  const [appliedPullPreset, setAppliedPullPreset] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveKind, setSaveKind] = useState<JobKind>('push')
  const [presetName, setPresetName] = useState('')
  const [relink, setRelink] = useState(false)
  const [saveMsg, setSaveMsg] = useState<Status | null>(null)

  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [failedOnly, setFailedOnly] = useState(false)
  const [verify, setVerify] = useState(false)

  const [pullServerId, setPullServerId] = useState('')
  const [pullPaths, setPullPaths] = useState<string[]>([])
  const [pullDir, setPullDir] = useState(loadPullDir)
  const [pullStatus, setPullStatus] = useState<Status | null>(null)

  const [job, setJob] = useState<JobSnapshot | null>(null)
  const [busy, setBusy] = useState<JobKind | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const jobIdRef = useRef<string | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  const reloadServers = useCallback(async () => {
    const r = await api.getServers()
    if (r.ok && r.servers) setServers(r.servers)
  }, [])

  const reloadPresets = useCallback(async () => {
    const r = await api.getPresets()
    if (r.ok && r.presets) setPresets(r.presets)
  }, [])

  useEffect(() => {
    void Promise.all([reloadServers(), reloadPresets()]).then(() => setLoaded(true))
  }, [reloadServers, reloadPresets])
  useEffect(() => {
    void api.getHosts().then(r => {
      if (r.ok) setHosts(r as HostsInfo)
    })
  }, [])
  useEffect(() => () => unsubRef.current?.(), [])
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {}
  }, [view])

  useEffect(() => {
    if (view !== 'log') return
    let alive = true
    const tick = async () => {
      const r = await api.getActivity()
      if (alive && r.ok && r.events) setActivity(r.events)
    }
    void tick()
    const id = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [view])

  const toggle = useCallback((serverId: string, dir: string) => {
    const key = targetKey(serverId, dir)
    setSel(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setAppliedPreset(null)
  }, [])

  const addPath = useCallback((serverId: string, raw: string): string | null => {
    const dir = raw.trim().replace(/(.)\/+$/, '$1')
    if (!dir) return '路径不能为空'
    if (!dir.startsWith('/') && !dir.startsWith('~')) return '用绝对路径或 ~ 开头'
    setSel(prev => new Set(prev).add(targetKey(serverId, dir)))
    setAppliedPreset(null)
    return null
  }, [])

  const toggleByKey = useCallback(
    (key: string) => {
      const { serverId, dir } = splitKey(key)
      toggle(serverId, dir)
    },
    [toggle]
  )

  const tags = useMemo(
    () => [...new Set(servers.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [servers]
  )

  const toggleTag = useCallback(
    (tag: string) => {
      const keys = servers.filter(s => s.tags?.includes(tag)).flatMap(s => s.dirs.map(d => targetKey(s.id, d)))
      setSel(prev => {
        const next = new Set(prev)
        const allOn = keys.every(k => next.has(k))
        keys.forEach(k => {
          allOn ? next.delete(k) : next.add(k)
        })
        return next
      })
      setAppliedPreset(null)
    },
    [servers]
  )

  const selected = useMemo<SelectedTarget[]>(() => {
    const out: SelectedTarget[] = []
    for (const key of sel) {
      const { serverId, dir } = splitKey(key)
      const server = servers.find(s => s.id === serverId)
      if (server && dir) out.push({ key, server, dir })
    }
    return out
  }, [sel, servers])

  const totalTargets = useMemo(() => servers.reduce((n, s) => n + s.dirs.length, 0), [servers])

  const check = useCallback(async (serverId: string) => {
    setChecks(c => ({ ...c, [serverId]: 'testing' }))
    const r = await api.checkServer(serverId)
    setChecks(c => ({
      ...c,
      [serverId]: {
        ok: !!r.ok,
        reason: why(r),
        dirs: Array.isArray(r.dirs) ? r.dirs : [],
        at: Date.now()
      }
    }))
  }, [])

  const checkAll = useCallback(() => {
    servers.forEach(s => void check(s.id))
  }, [servers, check])

  const probeOf = useCallback(
    (serverId: string): Probe => {
      const c = checks[serverId]
      if (!c) return 'idle'
      if (c === 'testing') return 'testing'
      return c.ok ? 'ok' : 'fail'
    },
    [checks]
  )

  const patchDraft = useCallback((patch: Partial<ServerDraft>) => {
    setDraft(d => ({ ...d, ...patch }))
  }, [])

  const openNew = useCallback(() => {
    setForm('new')
    setFormMsg(null)
    setDraft(emptyDraft())
  }, [])

  const openEdit = useCallback(
    (id: string) => {
      const s = servers.find(x => x.id === id)
      if (!s) return
      setForm(id)
      setFormMsg(null)
      setDraft({
        name: s.name && s.name !== s.host ? s.name : '',
        tags: [...(s.tags ?? [])],
        host: s.host,
        port: s.port ? String(s.port) : '',
        dirs: s.dirs.length ? [...s.dirs] : [''],
        auth: s.auth,
        password: ''
      })
    },
    [servers]
  )

  const closeForm = useCallback(() => {
    setForm(null)
    setFormMsg(null)
  }, [])

  const checkForm = useCallback(async () => {
    const dirs = draft.dirs.map(d => d.trim()).filter(Boolean)
    if (!draft.host.trim() || dirs.length === 0) {
      return setFormMsg({ text: '先填主机和至少一个常用目录', bad: true })
    }
    if (draft.auth === 'password' && !draft.password && form === 'new') {
      return setFormMsg({ text: '先填密码', bad: true })
    }
    setFormMsg({ text: '检测中…', bad: false })
    const reuseKeychain = form && form !== 'new' && draft.auth === 'password' && !draft.password
    const r = reuseKeychain ? await api.checkServer(form) : await api.checkDraft(draft)
    const detail =
      Array.isArray(r.dirs) && r.dirs.length > 1
        ? '\n' + r.dirs.map(d => `${d.ok ? '✓' : '✗'} ${d.dir} ${d.reason}`).join('\n')
        : ''
    setFormMsg({ text: `${r.ok ? '✓' : '✗'} ${why(r)}${detail}`, bad: !r.ok })
  }, [draft, form])

  const submitForm = useCallback(async () => {
    const r = form === 'new' ? await api.createServer(draft) : await api.saveServer(form!, draft)
    if (!r.ok) return setFormMsg({ text: why(r), bad: true })
    const created = form === 'new' ? (r as Server) : null
    closeForm()
    await reloadServers()
    if (created?.id && Array.isArray(created.dirs)) {
      setSel(prev => {
        const next = new Set(prev)
        created.dirs.forEach(d => next.add(targetKey(created.id, d)))
        return next
      })
    }
  }, [draft, form, closeForm, reloadServers])

  const pinPath = useCallback(
    async (serverId: string, dir: string) => {
      const s = servers.find(x => x.id === serverId)
      if (!s || s.dirs.includes(dir)) return
      const r = await api.saveServer(s.id, {
        name: s.name && s.name !== s.host ? s.name : '',
        tags: [...(s.tags ?? [])],
        host: s.host,
        port: s.port ? String(s.port) : '',
        dirs: [...s.dirs, dir],
        auth: s.auth,
        password: ''
      })
      if (!r.ok) return setStatus({ text: why(r), bad: true })
      await reloadServers()
      setStatus({ text: `已把 ${dir} 存为 ${s.name} 的常用目录`, bad: false })
    },
    [servers, reloadServers]
  )

  const remove = useCallback(
    async (id: string) => {
      const s = servers.find(x => x.id === id)
      if (!s) return
      const extra = s.auth === 'password' ? '\n钥匙串里的密码也会一并删除。' : ''
      if (!confirm(`删除「${s.name}」？${extra}`)) return
      const r = await api.deleteServer(id)
      if (!r.ok) return
      setSel(prev => {
        const next = new Set(prev)
        for (const k of next) if (splitKey(k).serverId === id) next.delete(k)
        return next
      })
      if (form === id) closeForm()
      await reloadServers()
    },
    [servers, form, closeForm, reloadServers]
  )

  const pickFile = useCallback(async (file: File) => {
    setStaging({ name: file.name, pct: 0 })
    setStatus(null)
    try {
      const r = await api.upload(file, pct => setStaging({ name: file.name, pct }))
      setSrc(r.source)
      setSize(r.size)
      setStaging(null)
    } catch (e) {
      setStaging(null)
      setStatus({ text: `暂存失败：${(e as Error).message}`, bad: true })
    }
  }, [])

  const typeSrc = useCallback((v: string) => {
    setSrc(v)
    setSize(null)
    setStaging(null)
  }, [])

  const adhocTargets = useMemo(
    () =>
      adhoc
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
    [adhoc]
  )

  const ready = src.trim().length > 0 && selected.length + adhocTargets.length > 0

  const reportTo = (kind: JobKind) => (kind === 'pull' ? setPullStatus : setStatus)

  const listen = useCallback(
    (id: string, kind: JobKind) => {
      const report = reportTo(kind)
      unsubRef.current?.()
      unsubRef.current = api.subscribe(
        id,
        snap => {
          setJob(snap)
          if (!snap.done) return
          setBusy(null)
          void reloadPresets()
          const cancelled = snap.targets.filter(t => t.error === '已取消').length
          const bad = snap.targets.filter(t => t.status === 'error').length - cancelled
          const ok = snap.targets.length - bad - cancelled
          if (!bad && !cancelled) {
            report({ text: `全部完成 · ${ok} ${kind === 'pull' ? '项' : '个目标'}`, bad: false })
          } else {
            const parts: string[] = []
            if (ok) parts.push(`${ok} 成功`)
            if (bad) parts.push(`${bad} 失败`)
            if (cancelled) parts.push(`${cancelled} 已取消`)
            report({ text: parts.join('，'), bad: bad > 0 })
          }
        },
        () => {
          setBusy(null)
          report({ text: '连接中断', bad: true })
        }
      )
    },
    [reloadPresets]
  )

  const runPush = useCallback(
    async (source: string, targets: api.TargetRef[], presetId?: string) => {
      if (!source.trim() || targets.length === 0) return
      if (busy) return setStatus({ text: '还有任务在进行中，等它结束或取消后再推', bad: true })
      setBusy('push')
      setStatus({ text: '启动中…', bad: false })
      const r = await api.startJob(source.trim(), targets, presetId, verify)
      if (!r.ok || !r.id) {
        setBusy(null)
        return setStatus({ text: why(r), bad: true })
      }
      jobIdRef.current = r.id
      listen(r.id, 'push')
    },
    [listen, verify, busy]
  )

  const push = useCallback(() => {
    if (!ready || busy) return
    void runPush(
      src,
      [...selected.map(t => ({ serverId: t.server.id, dir: t.dir })), ...adhocTargets],
      appliedPreset ?? undefined
    )
  }, [ready, busy, src, selected, adhocTargets, appliedPreset, runPush])

  const applyPreset = useCallback(
    async (p: PushPreset, run: boolean) => {
      const live: { serverId: string; dir: string }[] = []
      for (const t of p.targets) {
        const s = servers.find(x => x.id === t.serverId)
        if (!s) continue
        const dir = t.dir ?? s.dirs[0]
        if (dir) live.push({ serverId: s.id, dir })
      }
      const missing = p.targets.length - live.length
      setSel(new Set(live.map(t => targetKey(t.serverId, t.dir))))
      setAdhoc(p.adhoc.join('\n'))
      setSrc(p.src)
      setSize(null)
      setStaging(null)
      setAppliedPreset(p.id)
      setView('push')
      setStatus(missing > 0 ? { text: `方案里有 ${missing} 个目标已失效（服务器被删），已跳过`, bad: true } : null)
      if (!run) return
      if (!p.src.trim()) {
        return setStatus({ text: '这个方案每次都要重新选来源', bad: true })
      }
      await runPush(p.src, [...live, ...p.adhoc], p.id)
    },
    [servers, runPush]
  )

  const removePreset = useCallback(
    async (id: string) => {
      const p = presets.find(x => x.id === id)
      if (!p || !confirm(`删除方案「${p.name}」？`)) return
      const r = await api.deletePreset(id)
      if (!r.ok) return
      if (appliedPreset === id) setAppliedPreset(null)
      if (appliedPullPreset === id) setAppliedPullPreset(null)
      await reloadPresets()
    },
    [presets, appliedPreset, appliedPullPreset, reloadPresets]
  )

  const pullServer = useMemo(
    () => servers.find(s => s.id === pullServerId) ?? servers[0] ?? null,
    [servers, pullServerId]
  )

  const choosePullServer = useCallback((id: string) => {
    setPullServerId(id)
    setPullPaths([])
    setPullStatus(null)
    setAppliedPullPreset(null)
  }, [])

  const togglePullPath = useCallback((path: string) => {
    setPullPaths(prev => (prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]))
    setPullStatus(null)
    setAppliedPullPreset(null)
  }, [])

  const pullReady = !!pullServer && pullPaths.length > 0 && pullDir.trim().length > 0

  const runPull = useCallback(
    async (serverId: string, paths: string[], localDir: string, presetId?: string) => {
      if (!serverId || paths.length === 0 || !localDir.trim()) return
      if (busy) return setPullStatus({ text: '还有任务在进行中，等它结束或取消后再拉', bad: true })
      setBusy('pull')
      setPullStatus({ text: '启动中…', bad: false })
      const r = await api.startPull(serverId, paths, localDir.trim(), presetId)
      if (!r.ok || !r.id) {
        setBusy(null)
        return setPullStatus({ text: why(r), bad: true })
      }
      try {
        localStorage.setItem(PULL_DIR_KEY, localDir.trim())
      } catch {}
      jobIdRef.current = r.id
      listen(r.id, 'pull')
    },
    [busy, listen]
  )

  const pull = useCallback(() => {
    if (!pullReady || !pullServer) return
    void runPull(pullServer.id, pullPaths, pullDir, appliedPullPreset ?? undefined)
  }, [pullReady, pullServer, pullPaths, pullDir, appliedPullPreset, runPull])

  const applyPullPreset = useCallback(
    async (p: PullPreset, run: boolean) => {
      setView('pull')
      if (!servers.some(s => s.id === p.serverId)) {
        return setPullStatus({ text: `方案「${p.name}」里的服务器已被删除`, bad: true })
      }
      setPullServerId(p.serverId)
      setPullPaths(p.paths)
      setPullDir(p.localDir)
      setAppliedPullPreset(p.id)
      setPullStatus(null)
      if (run) await runPull(p.serverId, p.paths, p.localDir, p.id)
    },
    [servers, runPull]
  )

  const savePreset = useCallback(async () => {
    const typed = presetName.trim()
    const r =
      saveKind === 'pull'
        ? await api.createPreset({
            kind: 'pull',
            name: typed || (pullServer ? `从 ${pullServer.name} 拉取` : '新方案'),
            serverId: pullServer?.id ?? '',
            paths: pullPaths,
            localDir: pullDir.trim()
          })
        : await api.createPreset({
            kind: 'push',
            name: typed || src.split('/').filter(Boolean).pop() || '新方案',
            src: relink ? '' : src.trim(),
            targets: selected.map(t => ({ serverId: t.server.id, dir: t.dir })),
            adhoc: adhocTargets
          })
    if (!r.ok) return setSaveMsg({ text: why(r), bad: true })
    setSaveOpen(false)
    setPresetName('')
    setSaveMsg(null)
    if (r.id) (saveKind === 'pull' ? setAppliedPullPreset : setAppliedPreset)(r.id)
    await reloadPresets()
  }, [saveKind, presetName, pullServer, pullPaths, pullDir, src, selected, adhocTargets, relink, reloadPresets])

  const pushPresets = useMemo(() => presets.filter((p): p is PushPreset => p.kind === 'push'), [presets])
  const pullPresets = useMemo(() => presets.filter((p): p is PullPreset => p.kind === 'pull'), [presets])

  const pullStatusText = useMemo<Status>(() => {
    if (pullStatus) return pullStatus
    if (!pullServer) return { text: '还没有服务器', bad: false }
    if (pullPaths.length === 0) return { text: '在上面勾选要拉取的文件或目录', bad: false }
    if (!pullDir.trim()) return { text: '填一个本地目录', bad: false }
    return { text: `${pullServer.name} · ${pullPaths.length} 项 → ${pullDir.trim()}`, bad: false }
  }, [pullStatus, pullServer, pullPaths.length, pullDir])

  const retry = useCallback(async () => {
    const id = jobIdRef.current
    if (!id || !job) return
    const report = reportTo(job.kind)
    setBusy(job.kind)
    report({ text: '重试中…', bad: false })
    const r = await api.retryJob(id)
    if (!r.ok) {
      setBusy(null)
      return report({ text: why(r), bad: true })
    }
    listen(id, job.kind)
  }, [listen, job])

  const cancelJob = useCallback(async () => {
    const id = jobIdRef.current
    if (!id || !job) return
    reportTo(job.kind)({ text: '正在取消…', bad: false })
    await api.cancelJob(id)
  }, [job])

  const revealJob = useCallback(() => {
    if (jobIdRef.current) void api.revealJob(jobIdRef.current)
  }, [])

  const dismissJob = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
    setJob(null)
  }, [])

  const failedCount = job ? job.targets.filter(t => t.status === 'error').length : 0

  const statusText = useMemo<Status>(() => {
    if (status) return status
    const count = selected.length + adhocTargets.length
    if (!src.trim()) return { text: '先选择本地来源', bad: false }
    if (count === 0) return { text: '还没选目标', bad: false }
    const name = src.split('/').filter(Boolean).pop() || src
    const head = [name, size != null ? api.formatSize(size) : null].filter(Boolean).join(' · ')
    return { text: `${head} → ${count} 个目标`, bad: false }
  }, [status, src, size, selected.length, adhocTargets.length])

  return {
    view,
    setView,
    loaded,
    servers,
    tags,
    selected,
    sel,
    toggle,
    toggleByKey,
    toggleTag,
    addPath,
    pinPath,
    totalTargets,
    checks,
    probeOf,
    check,
    checkAll,
    hosts,
    form,
    draft,
    patchDraft,
    formMsg,
    openNew,
    openEdit,
    closeForm,
    checkForm,
    submitForm,
    remove,
    src,
    setSrc: typeSrc,
    size,
    staging,
    pickFile,
    adhoc,
    setAdhoc,
    adhocTargets,
    job,
    busy,
    ready,
    push,
    retry,
    dismissJob,
    cancelJob,
    revealJob,
    failedCount,
    pullServer,
    choosePullServer,
    pullPaths,
    togglePullPath,
    pullDir,
    setPullDir,
    pullReady,
    pull,
    pullStatusText,
    verify,
    toggleVerify: () => setVerify(v => !v),
    activity,
    failedOnly,
    setFailedOnly,
    presets,
    pushPresets,
    pullPresets,
    appliedPreset,
    applyPreset,
    removePreset,
    appliedPullPreset,
    applyPullPreset,
    saveOpen,
    saveKind,
    openSave: (kind: JobKind) => {
      setSaveKind(kind)
      setSaveMsg(null)
      setSaveOpen(true)
    },
    closeSave: () => setSaveOpen(false),
    presetName,
    setPresetName,
    relink,
    toggleRelink: () => setRelink(v => !v),
    saveMsg,
    savePreset,
    statusText
  }
}
