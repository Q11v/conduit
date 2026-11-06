import { useState } from 'react'
import { why } from '../api'
import { Github, Doc } from './Icons'
import { REPO } from '@/lib/links'
import { tildify } from '@/lib/paths'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import type { HostsInfo } from '../types'

export function HeaderLinks({ hosts }: { hosts: HostsInfo | null }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const backup = async (action: 'export' | 'restore' | 'repair') => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await window.desktop.backup[action]()
      if (!result.ok) setMessage(why(result))
      else if (!result.canceled) {
        if (action !== 'export') window.location.reload()
        else setMessage('备份已导出')
      }
    } catch (e) {
      setMessage(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex shrink-0 items-center gap-1 text-[12px] text-mute-3">
      {hosts && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2 cursor-pointer text-mute hover:bg-fg/4 hover:text-fg-dim"
            >
              <Doc size={14} />
              <span>配置文件</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-[min(360px,calc(100vw-32px))] p-3.5">
            <p className="m-0 mb-3 text-[13px] font-medium">本机配置文件</p>
            <div className="flex flex-col gap-3">
              {[
                ['服务器配置', hosts.configPath],
                ['保存的方案', hosts.presetsPath],
                ['书签与工作台', hosts.settingsPath]
              ].map(([label, path]) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 text-[12px] text-fg-dim">{label}</div>
                    <div className="font-mono text-[11px] text-mute break-all select-all" title={path}>
                      {tildify(path, hosts.home)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void window.desktop.reveal([path])}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] text-violet-text hover:bg-fg/5 cursor-pointer"
                  >
                    显示位置
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t hair pt-3">
              {(
                [
                  ['export', '导出备份'],
                  ['restore', '导入备份'],
                  ['repair', '修复自动备份']
                ] as const
              ).map(([action, label]) => (
                <button
                  key={action}
                  disabled={busy}
                  onClick={() => void backup(action)}
                  className="rounded-md border hair-2 px-2 py-1.5 text-xs text-fg-dim hover:bg-fg/5 cursor-pointer disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
            {message && (
              <p role="status" className="mt-2 break-all text-xs text-mute">
                {message}
              </p>
            )}
          </PopoverContent>
        </Popover>
      )}
      <a
        aria-label="GitHub 仓库"
        title="GitHub 仓库"
        href={REPO}
        target="_blank"
        rel="noreferrer noopener"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-mute no-underline hover:bg-fg/4 hover:text-fg-dim"
      >
        <Github />
        <span>GitHub</span>
      </a>
    </div>
  )
}
