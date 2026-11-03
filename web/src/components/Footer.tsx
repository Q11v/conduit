import { Github } from './Icons'
import { REPO } from '@/lib/links'
import { tildify } from '@/lib/paths'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import type { HostsInfo } from '../types'

export function Footer({ hosts }: { hosts: HostsInfo | null }) {
  return (
    <footer className="border-t hair">
      <div className="max-w-[1000px] mx-auto flex items-center gap-4 flex-wrap px-5 py-4 text-[12px] text-mute-3">
        <span>Conduit · 仅监听本机 127.0.0.1，配置只留在这台机器</span>
        <div className="flex-1" />
        {hosts && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="cursor-pointer text-mute-3 hover:text-fg-dim">
                配置文件
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[min(360px,calc(100vw-32px))] p-3.5">
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
          href={REPO}
          target="_blank"
          rel="noreferrer noopener"
          className="flex shrink-0 items-center gap-1.5 text-mute-3 no-underline hover:text-fg-dim"
        >
          <Github />
          GitHub
        </a>
      </div>
    </footer>
  )
}
