import { useEffect, useRef, useState } from 'react'
import { Doc, Files, Folder, Trash } from './Icons'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Btn, IconBtn, SectionHeader } from './ui'
import { formatLastRun, stagedName } from '../api'
import type { Preset, PullPreset, PushPreset, Server } from '../types'

interface Props<P extends Preset> {
  kind: P['kind']
  loaded: boolean
  presets: P[]
  servers: Server[]
  applied: string | null
  onApply: (p: P, run: boolean) => void
  onDelete: (id: string) => void
}

interface Summary {
  count: string
  broken: string | null
  source?: string
  rows: [string, React.ReactNode][]
}

const none = (text: string) => <span className="text-mute-3">{text}</span>

function describePush(p: PushPreset, servers: Server[]): Summary {
  const resolved = p.targets.map(t => {
    const s = servers.find(x => x.id === t.serverId)
    if (!s) return null
    const dir = t.dir ?? s.dirs[0]
    if (!dir) return null
    return `${s.host}${s.port ? ':' + s.port : ''}:${dir}`
  })
  const alive = resolved.filter((x): x is string => x !== null)
  const missing = resolved.length - alive.length
  const targets = [...alive, ...p.adhoc]
  const staged = stagedName(p.src)
  return {
    count: `${targets.length} 个目标`,
    broken: missing > 0 ? `${missing} 个已失效` : null,
    rows: [
      [
        '来源',
        staged ? (
          <span title={p.src}>
            {staged}
            <span className="text-mute-3"> · 临时副本</span>
          </span>
        ) : (
          p.src || none('每次推送前选择')
        )
      ],
      ['目标', targets.length ? <ItemList items={targets} /> : none('无')]
    ]
  }
}

function describePull(p: PullPreset, servers: Server[]): Summary {
  const s = servers.find(x => x.id === p.serverId)
  const addr = s ? `${s.host}${s.port ? ':' + s.port : ''}` : ''
  return {
    count: `${p.paths.length} 项`,
    broken: s ? null : '服务器已删除',
    source: s ? (s.name === s.host || s.name === addr ? addr : `${s.name} · ${addr}`) : undefined,
    rows: [
      ['路径', <ItemList items={p.paths} byDir />],
      ['本地', p.localDir]
    ]
  }
}

// 超过这个数量折叠成一行，完整列表放进悬浮层
const COLLAPSE_AT = 3

// 按父目录分组：/a/b/c.log → ['/a/b/', 'c.log']
function groupByDir(paths: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const p of paths) {
    const trimmed = p.replace(/\/+$/, '')
    const i = trimmed.lastIndexOf('/')
    const dir = i >= 0 ? trimmed.slice(0, i + 1) : ''
    const name = trimmed.slice(i + 1) || p
    groups.set(dir, [...(groups.get(dir) ?? []), name])
  }
  return [...groups]
}

// 悬停打开、移开延迟关闭；点击后固定，点外面或 Esc 才关
function useHoverPopover() {
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const schedule = (next: boolean, ms: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), ms)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const hover = {
    onMouseEnter: () => schedule(true, 120),
    onMouseLeave: () => !pinned.current && schedule(false, 180)
  }
  return {
    open,
    hover,
    onOpenChange: (next: boolean) => {
      clearTimeout(timer.current)
      pinned.current = next
      setOpen(next)
    }
  }
}

function ItemList({ items, byDir }: { items: string[]; byDir?: boolean }) {
  const { open, hover, onOpenChange } = useHoverPopover()
  if (items.length <= COLLAPSE_AT) return <span className="break-all">{items.join('、')}</span>

  const groups = byDir ? groupByDir(items) : [['', items] as [string, string[]]]

  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="flex-1 min-w-0 truncate">
        {groups.map(([dir, names], i) => (
          <span key={dir}>
            {i > 0 && <span className="text-mute-4">{'  ·  '}</span>}
            {dir && <span className="text-mute-4">{dir}</span>}
            {names.join(byDir ? ', ' : '、')}
          </span>
        ))}
      </span>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            {...hover}
            className={`inline-flex shrink-0 items-center gap-1 px-2 py-px rounded-md font-sans text-[12px] cursor-pointer transition-colors duration-150 ${
              open ? 'bg-[rgba(124,124,245,.18)] text-white' : 'text-violet-text hover:bg-[rgba(124,124,245,.14)]'
            }`}
          >
            <Files size={12} />
            {items.length} 项
          </button>
        </PopoverTrigger>
        <PopoverContent
          {...hover}
          align="end"
          onOpenAutoFocus={e => e.preventDefault()}
          className="w-[min(40rem,calc(100vw-32px))] p-0"
        >
          <div className="flex flex-col gap-3 max-h-[min(24rem,60vh)] overflow-auto p-3.5 font-mono text-[12px] leading-relaxed">
            {groups.map(([dir, names]) => (
              <div key={dir} className="flex flex-col gap-1 min-w-0">
                {dir && (
                  <div className="flex items-center gap-1.5 text-mute-3 break-all">
                    <Folder size={12} className="shrink-0" />
                    {dir}
                    <span className="text-mute-4 font-sans">· {names.length} 项</span>
                  </div>
                )}
                <ul
                  className={`m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-0.5 ${dir ? 'pl-[18px]' : ''}`}
                >
                  {names.map(n => (
                    <li key={n} className="truncate text-fg-dim" title={dir + n}>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const COPY = {
  push: {
    hint: '存下来的「来源 + 目标」，载入即可复用',
    run: '推送',
    never: '尚未推送',
    empty: (
      <>
        还没有方案。配好上面的来源和目标后，点「存为方案」存一份，
        <br />
        以后一键载入或直接推送。
      </>
    )
  },
  pull: {
    hint: '存下来的「服务器 + 路径 + 本地目录」，一键拉取',
    run: '拉取',
    never: '尚未拉取',
    empty: (
      <>
        还没有拉取方案。勾好上面的路径后，点「存为方案」存一份，
        <br />
        以后一键拉取。
      </>
    )
  }
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline gap-2.5">
    <span className="shrink-0 w-7 text-[12px] text-mute-4">{label}</span>
    <div className="flex-1 min-w-0 font-mono text-[12px] leading-relaxed text-fg-dim">{children}</div>
  </div>
)

function Card({
  p,
  summary,
  runLabel,
  never,
  active,
  onApply,
  onDelete
}: {
  p: Preset
  summary: Summary
  runLabel: string
  never: string
  active: boolean
  onApply: (run: boolean) => void
  onDelete: () => void
}) {
  return (
    <div
      className={`flex flex-col gap-3 min-w-0 p-4 border rounded-[14px] transition-colors duration-150 ${
        active
          ? 'border-[rgba(124,124,245,.45)] bg-[rgba(124,124,245,.1)]'
          : 'border-[rgba(255,255,255,.08)] panel hover:border-[rgba(255,255,255,.16)]'
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex shrink-0 items-center justify-center w-[26px] h-[26px] rounded-lg bg-[rgba(124,124,245,.16)] text-violet-text">
          <Doc />
        </span>

        <div className="flex-1 min-w-[10rem] flex items-center gap-2.5 flex-wrap">
          <span className="text-[13.5px] font-semibold truncate max-w-full">{p.name}</span>
          {summary.source && (
            <span className="min-w-0 font-mono text-[12.5px] text-fg-dim truncate">
              <span className="text-mute-4">@ </span>
              {summary.source}
            </span>
          )}
          <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[rgba(255,255,255,.07)] text-[12px] text-fg-dim">
            {summary.count}
          </span>
          <span className="shrink-0 text-[12px] text-mute-3">{formatLastRun(p.lastRun, never)}</span>
          {summary.broken && (
            <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[rgba(226,86,86,.14)] text-[12px] text-err-text">
              {summary.broken}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Btn onClick={() => onApply(false)} className="px-4 py-1.5 text-xs">
            载入
          </Btn>
          <Btn variant="primary" onClick={() => onApply(true)} className="px-4 py-1.5 text-xs">
            {runLabel}
          </Btn>
          <IconBtn
            onClick={onDelete}
            danger
            className="w-[30px] h-[28px] shrink-0 border hair-2 rounded-[9px]"
            title="删除方案"
          >
            <Trash />
          </IconBtn>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {summary.rows.map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
      </div>
    </div>
  )
}

export function PresetGrid<P extends Preset>({ kind, loaded, presets, servers, applied, onApply, onDelete }: Props<P>) {
  const copy = COPY[kind]
  return (
    <div>
      <SectionHeader title="方案" hint={copy.hint} />

      {!loaded ? (
        <div className="px-5 py-8 border border-dashed border-[rgba(255,255,255,.08)] rounded-2xl text-center text-[13px] text-mute-4">
          载入中…
        </div>
      ) : presets.length === 0 ? (
        <div className="px-5 py-8 border border-dashed border-[rgba(255,255,255,.14)] rounded-2xl text-center">
          <p className="m-0 text-[13px] leading-relaxed text-mute-2">{copy.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {presets.map(p => (
            <Card
              key={p.id}
              p={p}
              summary={p.kind === 'pull' ? describePull(p, servers) : describePush(p, servers)}
              runLabel={copy.run}
              never={copy.never}
              active={applied === p.id}
              onApply={run => onApply(p, run)}
              onDelete={() => onDelete(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
