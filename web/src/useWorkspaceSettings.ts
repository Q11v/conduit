import { useCallback, useEffect, useRef, useState } from 'react'
import { why } from './api'
import type { WorkspaceSettings } from './types'

function legacySettings(): Partial<WorkspaceSettings> {
  const legacy: Partial<WorkspaceSettings> = {}
  try {
    const raw = JSON.parse(localStorage.getItem('conduit.bookmarks') || 'null')
    if (Array.isArray(raw))
      legacy.bookmarks = raw.filter(
        b => b && ['id', 'name', 'local', 'remote', 'serverId'].every(key => typeof b[key] === 'string')
      )
  } catch {
    /* Keep malformed legacy data intact; migrate the remaining settings. */
  }
  try {
    const raw = JSON.parse(localStorage.getItem('conduit.local-favorites') || 'null')
    if (Array.isArray(raw))
      legacy.localFavorites = raw.filter((path): path is string => typeof path === 'string' && Boolean(path.trim()))
  } catch {
    /* Other legacy fields can still be migrated. */
  }
  const directory = localStorage.getItem('conduit.pullDir')
  const view = localStorage.getItem('conduit.view')
  if (directory) legacy.localDirectory = directory
  if (view === 'workbench' || view === 'plans' || view === 'log') legacy.view = view
  return legacy
}

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null)
  const [error, setError] = useState('')
  const queue = useRef(Promise.resolve())
  const revision = useRef(0)
  useEffect(() => {
    let active = true
    void window.desktop.settings
      .get(legacySettings())
      .then(result => {
        if (!active) return
        if (result.ok) setSettings(result.settings)
        else setError(why(result))
      })
      .catch(e => {
        if (active) setError(String(e))
      })
    return () => {
      active = false
    }
  }, [])
  const update = useCallback((patch: Partial<WorkspaceSettings>) => {
    const request = ++revision.current
    setSettings(current => (current ? { ...current, ...patch } : current))
    const operation = queue.current.then(async () => {
      const result = await window.desktop.settings.update(patch)
      if (!result.ok) throw new Error(why(result))
      if (request === revision.current) {
        setSettings(result.settings)
        setError('')
      }
    })
    queue.current = operation.catch(e => {
      setError(String(e))
    })
    return operation
  }, [])
  return { settings, error, update }
}
