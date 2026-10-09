import { useRef, useState, type KeyboardEvent } from 'react'
import { Chevron, Plus } from './Icons'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Chip, InlineAdd, ProbeBadge } from './ui'
import type { Probe, Server } from '../types'
import { splitKey, targetKey } from '../types'

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
const tabbables = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0)

interface Props {
  servers: Server[]
  tags: string[]
  sel: Set<string>
  totalTargets: number
  probeOf: (serverId: string) => Probe
  adhoc: string
  onToggle: (serverId: string, dir: string) => void
  onToggleTag: (tag: string) => void
  onAddPath: (serverId: string, dir: string) => string | null
  onAdhoc: (v: string) => void
  onGoServers: () => void
  empty: boolean
}

export function TargetPicker(p: Props) {
  const [open, setOpen] = useState(false)
  const [adhocOpen, setAdhocOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  const tabOut = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || !trigger.current) return
    const panel = e.currentTarget
    const inside = tabbables(panel)
    if (document.activeElement !== (e.shiftKey ? inside[0] : inside.at(-1))) return
    let dest: HTMLElement | undefined = trigger.current
    if (!e.shiftKey) {
      const page = tabbables(document).filter(el => !panel.contains(el))
      dest = page[page.indexOf(trigger.current) + 1]
      if (!dest) return
    }
    e.preventDefault()
    dest.focus()
    setOpen(false)
  }

  const adhocCount = p.adhoc.split('\n').filter(l => l.trim()).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {p.empty ? (
          <button
            ref={trigger}
            type="button"
            className="block w-full px-3 py-2 border border-dashed border-[rgba(255,255,255,.16)] rounded-[11px] bg-transparent text-left text-mute-3 text-[13px] cursor-pointer transition-all duration-150 hover:border-[rgba(124,124,245,.6)] hover:text-violet-text"
          >
            还没有选中任何目录 · 点此选择
          </button>
        ) : (
          <button
            ref={trigger}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-[rgba(255,255,255,.16)] rounded-[11px] bg-transparent text-mute-3 text-[13px] cursor-pointer transition-all duration-150 hover:border-[rgba(124,124,245,.6)] hover:text-violet-text"
            title="添加目标"
          >
            <Plus size={13} />
            添加
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        avoidCollisions={false}
        collisionPadding={16}
        onKeyDownCapture={tabOut}
        className="z-20 w-[min(420px,calc(100vw-56px))] max-h-[min(58vh,420px,var(--radix-popover-content-available-height))] flex flex-col overflow-hidden"
      >
        <div className="flex-1 min-h-0 overflow-auto p-2.5">
          {p.servers.length === 0 && (
            <div className="px-2 py-6 text-center text-[13px] text-mute-3">还没有配置服务器</div>
          )}

          {p.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2.5 mb-2 border-b hair">
              <span className="shrink-0 mr-0.5 text-[12px] text-mute-4">按标签</span>
              {p.tags.map(t => {
                const keys = p.servers
                  .filter(s => s.tags?.includes(t))
                  .flatMap(s => s.dirs.map(d => targetKey(s.id, d)))
                const allOn = keys.length > 0 && keys.every(k => p.sel.has(k))
                return (
                  <Chip
                    key={t}
                    active={allOn}
                    onClick={() => p.onToggleTag(t)}
                    title={allOn ? '取消这个标签下的全部目录' : '勾选这个标签下的全部目录'}
                  >
                    {allOn ? '✓ ' : ''}
                    {t}
                  </Chip>
                )
              })}
            </div>
          )}

          {p.servers.map(s => (
            <div key={s.id} className="mb-1.5 last:mb-0">
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="min-w-0 text-[12px] font-medium truncate">{s.name}</span>
                {s.name !== s.host && (
                  <span className="min-w-0 font-mono text-[12px] text-mute-4 truncate">{s.host}</span>
                )}
                <span className="flex-1" />
                <ProbeBadge probe={p.probeOf(s.id)} />
              </div>
              {[
                ...s.dirs,
                ...[...p.sel]
                  .map(splitKey)
                  .filter(k => k.serverId === s.id && !s.dirs.includes(k.dir))
                  .map(k => k.dir)
              ].map(dir => {
                const checked = p.sel.has(targetKey(s.id, dir))
                const custom = !s.dirs.includes(dir)
                return (
                  <label
                    key={dir}
                    className={`flex items-center gap-2.5 w-[calc(100%-6px)] ml-1.5 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-all duration-150 ${
                      checked ? 'bg-[rgba(124,124,245,.12)]' : 'hover:bg-[rgba(255,255,255,.05)]'
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => p.onToggle(s.id, dir)} />
                    <span className="flex-1 min-w-0 font-mono text-[12px] text-fg-dim break-all">{dir}</span>
                    {custom && <span className="shrink-0 text-[12px] text-cyan">临时</span>}
                  </label>
                )
              })}
              <div className="ml-1.5 px-2 pt-1">
                <InlineAdd label="其他路径" placeholder="/opt/app，回车添加" onAdd={v => p.onAddPath(s.id, v)} />
              </div>
            </div>
          ))}

          <div className="mt-2 pt-2 border-t hair">
            <button
              onClick={() => setAdhocOpen(v => !v)}
              className="flex items-center gap-2 w-full px-1 py-1.5 border-0 bg-transparent text-[12px] text-mute-2 cursor-pointer hover:text-fg-dim"
            >
              <Chevron size={12} className={`transition-transform duration-150 ${adhocOpen ? 'rotate-90' : ''}`} />
              临时目标
              {adhocCount > 0 && (
                <span className="px-1.5 rounded-full bg-[rgba(106,213,230,.16)] text-cyan text-[12px] font-semibold leading-4">
                  {adhocCount}
                </span>
              )}
              <span className="text-mute-4">不保存 · 仅密钥认证</span>
            </button>
            {adhocOpen && (
              <textarea
                value={p.adhoc}
                onChange={e => p.onAdhoc(e.target.value)}
                spellCheck={false}
                rows={3}
                placeholder={'deploy@10.0.0.9:/opt/app\n每行一个 host:/远程目录'}
                className="w-full mt-1 p-2 rounded-lg border field-edge sunken font-mono text-[12px] leading-relaxed text-fg outline-0 resize-y focus:border-[rgba(124,124,245,.7)]"
              />
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t hair bg-[rgba(255,255,255,.02)]">
          <span className="flex-1 text-[12px] text-mute-4">
            已选 {p.sel.size} 个目标
          </span>
          <button
            onClick={() => {
              setOpen(false)
              p.onGoServers()
            }}
            className="shrink-0 p-0 border-0 bg-transparent text-link text-[12px] cursor-pointer hover:underline"
          >
            管理服务器 →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
