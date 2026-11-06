import { Github } from './Icons'
import { REPO } from '@/lib/links'
import { tildify } from '@/lib/paths'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import type { HostsInfo } from '../types'

export function HeaderLinks({ hosts }: { hosts: HostsInfo | null }) {
  return (
    <div className="flex shrink-0 items-center gap-2 text-[12px] text-mute-3">
      {hosts && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-8 rounded-md px-2 cursor-pointer text-mute hover:bg-white/4 hover:text-fg-dim"
            >
              配置文件
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-[min(360px,calc(100vw-32px))] p-3.5">
            <p className="m-0 mb-3 text-[13px] font-medium">本机配置文件</p>
            <div className="flex flex-col gap-3">
              {[
                ['服务器配置', hosts.configPath],
                ['保存的方案', hosts.presetsPath]
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
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] text-violet-text hover:bg-white/5 cursor-pointer"
                  >
                    显示位置
                  </button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <a
        aria-label="GitHub 仓库"
        title="GitHub 仓库"
        href={REPO}
        target="_blank"
        rel="noreferrer noopener"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-mute no-underline hover:bg-white/4 hover:text-fg-dim"
      >
        <Github />
        <span className="hidden lg:inline">GitHub</span>
      </a>
    </div>
  )
}
