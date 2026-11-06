import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from './api'
import { why } from './api'
import type {
  ActivityEvent,
  Check,
  HostsInfo,
  JobKind,
  Preset,
  Probe,
  PullPreset,
  PushPreset,
  Server,
  ServerDraft
} from './types'
import { emptyDraft } from './types'
import { notifyError } from './lib/notifications'
import { useJobs } from './useJobs'
import { useWorkspaceSettings } from './useWorkspaceSettings'

export type View = 'workbench' | 'plans' | 'log'
export type FormMode = 'new' | (string & {}) | null
export interface Status {
  text: string
  bad: boolean
}
const setStatus = (status: Status | null) => {
  if (status?.bad) notifyError(status.text)
}
const setPullStatus = setStatus

export function useConduit() {
  const preferences = useWorkspaceSettings()
  const { update: updatePreferences } = preferences
  const view: View = preferences.settings?.view ?? 'workbench'
  const setView = useCallback(
    (next: View) => {
      void updatePreferences({ view: next }).catch(() => {})
    },
    [updatePreferences]
  )
  const [servers, setServers] = useState<Server[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [serversError, setServersError] = useState('')
  const [presetsError, setPresetsError] = useState('')
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const [hosts, setHosts] = useState<HostsInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<FormMode>(null)
  const [draft, setDraft] = useState<ServerDraft>(emptyDraft())
  const [formMsg, setFormMsg] = useState<Status | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [failedOnly, setFailedOnly] = useState(false)
  const reloadServers = useCallback(async () => {
    const result = await api.getServers()
    setServersError(result.ok ? '' : why(result))
    if (result.ok) setServers(result.servers)
  }, [])
  const reloadPresets = useCallback(async () => {
    const result = await api.getPresets()
    setPresetsError(result.ok ? '' : why(result))
    if (result.ok) setPresets(result.presets)
  }, [])
  const tasks = useJobs(reloadPresets)
  const { launch } = tasks
  const busyPresets = useMemo(
    () =>
      new Set([
        ...tasks.jobs.filter(j => !j.done && j.presetId).map(j => j.presetId!),
        ...[...tasks.pending].filter(k => k.startsWith('preset:')).map(k => k.slice(7))
      ]),
    [tasks.jobs, tasks.pending]
  )
  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      await Promise.all([reloadServers(), reloadPresets()])
      if (active) setLoaded(true)
      const hosts = await api.getHosts()
      if (active && hosts.ok) setHosts(hosts)
    })
    return () => {
      active = false
    }
  }, [reloadServers, reloadPresets])
  useEffect(() => {
    if (view !== 'log') return
    let active = true
    const refresh = async () => {
      const r = await api.getActivity()
      if (active && r.ok) setActivity(r.events)
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 2000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [view])
  const tags = useMemo(
    () => [...new Set(servers.flatMap(s => s.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [servers]
  )
  const pullServer = servers.find(s => s.id === preferences.settings?.remoteServerId) ?? servers[0] ?? null
  const choosePullServer = useCallback(
    (id: string) => {
      setPullStatus(null)
      void updatePreferences({ remoteServerId: id }).catch(() => {})
    },
    [updatePreferences]
  )
  const reorderServers = useCallback(
    async (ids: string[]) => {
      if (pullServer) await updatePreferences({ remoteServerId: pullServer.id })
      const positions = new Map(ids.map((id, i) => [id, i]))
      setServers(list =>
        [...list].sort((a, b) => (positions.get(a.id) ?? ids.length) - (positions.get(b.id) ?? ids.length))
      )
      const r = await api.reorderServers(ids)
      if (!r.ok) {
        await reloadServers()
        return why(r)
      }
      return null
    },
    [pullServer, updatePreferences, reloadServers]
  )
  const check = useCallback(async (serverId: string) => {
    setChecks(c => ({ ...c, [serverId]: 'testing' }))
    const r = await api.checkServer(serverId)
    setChecks(c => ({
      ...c,
      [serverId]: {
        ok: !!r.ok,
        reason: why(r),
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
        dirs: [...s.dirs],
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
    if (!draft.host.trim()) {
      return setFormMsg({ text: '先填主机', bad: true })
    }
    if (draft.auth === 'password' && !draft.password && form === 'new') {
      return setFormMsg({ text: '先填密码', bad: true })
    }
    setFormMsg({ text: '检测中…', bad: false })
    const reuseKeychain = form && form !== 'new' && draft.auth === 'password' && !draft.password
    const r = reuseKeychain ? await api.checkServer(form) : await api.checkDraft(draft)
    setFormMsg({ text: `${r.ok ? '✓' : '✗'} ${why(r)}`, bad: !r.ok })
  }, [draft, form])

  const submitForm = useCallback(async () => {
    const r = form === 'new' ? await api.createServer(draft) : await api.saveServer(form!, draft)
    if (!r.ok) return setFormMsg({ text: why(r), bad: true })
    closeForm()
    await reloadServers()
  }, [draft, form, closeForm, reloadServers])

  const reportTo = (kind: JobKind) => (kind === 'pull' ? setPullStatus : setStatus)

  const saveDirs = useCallback(
    async (serverId: string, dirs: string[], done: string, kind: JobKind) => {
      const report = reportTo(kind)
      const s = servers.find(x => x.id === serverId)
      if (!s) return
      const r = await api.saveServer(s.id, {
        name: s.name && s.name !== s.host ? s.name : '',
        tags: [...(s.tags ?? [])],
        host: s.host,
        port: s.port ? String(s.port) : '',
        dirs,
        auth: s.auth,
        password: ''
      })
      if (!r.ok) return report({ text: why(r), bad: true })
      await reloadServers()
      report({ text: `${done}（${s.name}）`, bad: false })
    },
    [servers, reloadServers]
  )

  const pinPath = useCallback(
    (serverId: string, dir: string, kind: JobKind = 'push') => {
      const s = servers.find(x => x.id === serverId)
      if (s && !s.dirs.includes(dir)) void saveDirs(serverId, [...s.dirs, dir], `已把 ${dir} 存为常用目录`, kind)
    },
    [servers, saveDirs]
  )

  const unpinPath = useCallback(
    (serverId: string, dir: string) => {
      const s = servers.find(x => x.id === serverId)
      if (s?.dirs.includes(dir))
        void saveDirs(
          serverId,
          s.dirs.filter(d => d !== dir),
          `已把 ${dir} 移出常用目录`,
          'push'
        )
    },
    [servers, saveDirs]
  )

  const remove = useCallback(
    async (id: string) => {
      const s = servers.find(x => x.id === id)
      if (!s) return
      const extra = s.auth === 'password' ? '钥匙串里的密码也会一并删除。' : undefined
      if (!(await window.desktop.confirm(`删除「${s.name}」？`, extra, '删除'))) return
      const r = await api.deleteServer(id)
      if (!r.ok) return
      if (form === id) closeForm()
      await reloadServers()
    },
    [servers, form, closeForm, reloadServers]
  )

  const runPush = useCallback(
    async (source: string, targets: api.TargetRef[], presetId?: string) => {
      if (!targets.length) return setStatus({ text: '至少选择一个有效目标', bad: true })
      const r = await launch(presetId ? `preset:${presetId}` : 'push-form', async () => {
        const chosen = source.trim() || (await window.desktop.pick())
        if (!chosen) return { ok: false, error: '已取消选择来源' }
        if (!(await window.desktop.stat(chosen).catch(() => null)))
          return { ok: false, error: '来源不存在或无法读取，请重新选择来源' }
        return api.startJob(chosen, targets, presetId)
      })
      setStatus(r.ok || why(r) === '已取消选择来源' ? null : { text: why(r), bad: true })
    },
    [launch]
  )
  const runPull = useCallback(
    async (serverId: string, paths: string[], localDir: string, presetId?: string) => {
      if (!serverId || !paths.length || !localDir.trim()) return
      const r = await launch(presetId ? `preset:${presetId}` : 'pull-form', () =>
        api.startPull(serverId, paths, localDir.trim(), presetId)
      )
      setPullStatus(r.ok ? null : { text: why(r), bad: true })
    },
    [launch]
  )
  const applyPreset = useCallback(
    async (preset: PushPreset) => {
      const targets: api.TargetRef[] = []
      for (const target of preset.targets) {
        const server = servers.find(s => s.id === target.serverId)
        const dir = target.dir ?? server?.dirs[0]
        if (!server || !dir) return setStatus({ text: '方案中有目标已失效，请编辑方案后重试', bad: true })
        targets.push({ serverId: server.id, dir })
      }
      await runPush(preset.src, [...targets, ...preset.adhoc], preset.id)
    },
    [servers, runPush]
  )
  const applyPullPreset = useCallback(
    async (preset: PullPreset) => {
      if (!servers.some(s => s.id === preset.serverId))
        return setPullStatus({ text: `方案「${preset.name}」里的服务器已被删除`, bad: true })
      await runPull(preset.serverId, preset.paths, preset.localDir, preset.id)
    },
    [servers, runPull]
  )
  const removePreset = useCallback(
    async (id: string) => {
      const preset = presets.find(p => p.id === id)
      if (!preset || !(await window.desktop.confirm(`删除方案「${preset.name}」？`, undefined, '删除'))) return
      const result = await api.deletePreset(id)
      if (!result.ok) return setStatus({ text: why(result), bad: true })
      await reloadPresets()
    },
    [presets, reloadPresets]
  )
  return {
    view,
    setView,
    preferences,
    loadError: [serversError, presetsError, preferences.error].filter(Boolean).join('\n'),
    loaded,
    servers,
    presets,
    tags,
    checks,
    hosts,
    form,
    draft,
    formMsg,
    patchDraft,
    openNew,
    openEdit,
    closeForm,
    checkForm,
    submitForm,
    remove,
    probeOf,
    check,
    checkAll,
    reloadPresets,
    reorderServers,
    pinPath,
    unpinPath,
    pullServer,
    choosePullServer,
    runPush,
    runPull,
    applyPreset,
    applyPullPreset,
    removePreset,
    busyPresets,
    jobs: tasks.jobs,
    pendingTasks: tasks.pending,
    dismissJob: tasks.dismissJob,
    cancelJob: tasks.cancelJob,
    retry: tasks.retry,
    revealJob: tasks.revealJob,
    activity,
    failedOnly,
    setFailedOnly
  }
}
