import { useEffect, useMemo, useRef, useState } from 'react'
import { Doc, Files, Folder, Grip, Trash } from './Icons'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Btn, IconBtn, SectionHeader } from './ui'
import { formatLastRun } from '../api'
import type { Preset, PullPreset, PushPreset, Server } from '../types'

interface Props<P extends Preset> {
  kind: P['kind']
  loaded: boolean
  presets: P[]
  servers: Server[]
  applied: string | null
  onApply: (p: P, run: boolean) => void
  onDelete: (id: string) => void
  onReorder: (ids: string[]) => void
}

interface Summary {
  count: string
  broken: string | null
  source?: string
  rows: [string, React.ReactNode][]
  // 来源文件 + 目标集合，完全相同即视为重复
  key?: string
}

// 来源归组：取文件名，去掉打包扩展名和版本号
// /x/servicepod-3.2.6.tar.gz → servicepod，/x/account-manager_v1.1.0.jar → account-manager
function srcGroup(src: string): string | null {
  const base = src.trim().replace(/\/+$/, '').split('/').pop()
  if (!base) return null
  const name = base
    .replace(/\.(tar\.(gz|bz2|xz|zst)|tgz|zip|jar|war|gz|tar|deb|rpm|apk|ipa|exe|dmg)$/i, '')
    .replace(/[-_.]?v?\d+(\.\d+)+.*$/i, '')
  return name || base
}

// 色相固定从哈希来，同一来源换版本、调顺序都不变色
const HUES = [262, 190, 38, 340, 150, 215, 20, 300]

function groupHue(group: string): number {
  let h = 0
  for (const ch of group) h = (h * 31 + ch.charCodeAt(0)) | 0
  return HUES[Math.abs(h) % HUES.length]
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
  return {
    key: p.src ? `${p.src.trim()}\n${[...targets].sort().join('\n')}` : undefined,
    count: `${targets.length} 个目标`,
    broken: missing > 0 ? `${missing} 个已失效` : null,
    rows: [
      ['来源', p.src || none('每次推送前选择')],
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

interface DragProps {
  dragging: boolean
  onGrab: (on: boolean) => void
  onMove: (delta: -1 | 1) => void
  cardProps: React.HTMLAttributes<HTMLDivElement> & { draggable: boolean }
}

function Card({
  p,
  summary,
  group,
  duplicate,
  runLabel,
  never,
  active,
  drag,
  onApply,
  onDelete
}: {
  p: Preset
  summary: Summary
  group: string | null
  duplicate: boolean
  runLabel: string
  never: string
  active: boolean
  drag: DragProps
  onApply: (run: boolean) => void
  onDelete: () => void
}) {
  const hue = group ? groupHue(group) : null
  return (
    <div
      {...drag.cardProps}
      style={hue === null ? undefined : { boxShadow: `inset 3px 0 0 hsl(${hue} 75% 62%)` }}
      className={`group/card flex flex-col gap-3 min-w-0 p-4 border rounded-[14px] transition-[colors,opacity] duration-150 ${
        active
          ? 'border-[rgba(124,124,245,.45)] bg-[rgba(124,124,245,.1)]'
          : 'border-[rgba(255,255,255,.08)] panel hover:border-[rgba(255,255,255,.16)]'
      } ${drag.dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          title="拖动排序（Alt + ↑/↓）"
          aria-label={`调整「${p.name}」的位置`}
          onMouseDown={() => drag.onGrab(true)}
          onMouseUp={() => drag.onGrab(false)}
          onKeyDown={e => {
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
            e.preventDefault()
            drag.onMove(e.key === 'ArrowUp' ? -1 : 1)
          }}
          style={hue === null ? undefined : { background: `hsl(${hue} 70% 60% / .16)`, color: `hsl(${hue} 85% 76%)` }}
          className="relative flex shrink-0 items-center justify-center w-[26px] h-[26px] rounded-lg bg-[rgba(124,124,245,.16)] text-violet-text cursor-grab active:cursor-grabbing"
        >
          <span className="group-hover/card:opacity-0 transition-opacity duration-150">
            <Doc />
          </span>
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
            <Grip />
          </span>
        </button>

        <div className="flex-1 min-w-[10rem] flex items-center gap-2.5 flex-wrap">
          <span className="text-[13.5px] font-semibold truncate max-w-full">{p.name}</span>
          {group && hue !== null && (
            <span
              style={{ background: `hsl(${hue} 70% 60% / .14)`, color: `hsl(${hue} 85% 76%)` }}
              className="shrink-0 px-2 py-px rounded-md font-mono text-[11.5px]"
              title="来源分组：同一来源文件的方案颜色相同"
            >
              {group}
            </span>
          )}
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
          {duplicate && (
            <span
              className="shrink-0 px-2.5 py-0.5 rounded-full bg-[rgba(230,170,60,.14)] text-[12px] text-[#e8b65a]"
              title="前面已有来源和目标完全相同的方案"
            >
              重复
            </span>
          )}
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

// 同组的挪到一起，组按首次出现的位置排，组内保持原顺序
function clusterByGroup(ids: string[], groupOf: Map<string, string | null>): string[] {
  const buckets = new Map<string, string[]>()
  for (const id of ids) {
    const k = groupOf.get(id) ?? `\0${id}`
    buckets.set(k, [...(buckets.get(k) ?? []), id])
  }
  return [...buckets.values()].flat()
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export function PresetGrid<P extends Preset>({
  kind,
  loaded,
  presets,
  servers,
  applied,
  onApply,
  onDelete,
  onReorder
}: Props<P>) {
  const copy = COPY[kind]

  // 拖动中的临时顺序；松手才提交
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [grabbed, setGrabbed] = useState<string | null>(null)

  const byId = useMemo(() => new Map(presets.map(p => [p.id, p])), [presets])
  const ordered = (dragOrder ?? presets.map(p => p.id)).map(id => byId.get(id)).filter((p): p is P => !!p)
  const ids = presets.map(p => p.id)

  const meta = useMemo(() => {
    const seen = new Set<string>()
    return new Map(
      presets.map(p => {
        const summary = p.kind === 'pull' ? describePull(p, servers) : describePush(p, servers)
        const duplicate = !!summary.key && seen.has(summary.key)
        if (summary.key) seen.add(summary.key)
        return [p.id, { summary, duplicate, group: p.kind === 'push' ? srcGroup(p.src) : null }]
      })
    )
  }, [presets, servers])

  const groupOf = new Map([...meta].map(([id, m]) => [id, m.group]))
  const clustered = clusterByGroup(ids, groupOf)
  const canCluster = clustered.some((id, i) => id !== ids[i])

  const finishDrag = () => {
    if (dragOrder && dragOrder.some((id, i) => id !== ids[i])) onReorder(dragOrder)
    setDragOrder(null)
    setDragId(null)
    setGrabbed(null)
  }

  const dragFor = (id: string): DragProps => ({
    dragging: dragId === id,
    onGrab: on => setGrabbed(on ? id : null),
    onMove: delta => {
      const i = ids.indexOf(id)
      const j = i + delta
      if (j >= 0 && j < ids.length) onReorder(move(ids, i, j))
    },
    cardProps: {
      draggable: grabbed === id,
      onDragStart: e => {
        e.dataTransfer.effectAllowed = 'move'
        setDragId(id)
        setDragOrder(ids)
      },
      onDragEnter: () => {
        if (!dragId || dragId === id || !dragOrder) return
        setDragOrder(move(dragOrder, dragOrder.indexOf(dragId), dragOrder.indexOf(id)))
      },
      onDragOver: e => dragId && e.preventDefault(),
      onDrop: e => e.preventDefault(),
      onDragEnd: finishDrag
    }
  })

  return (
    <div>
      <SectionHeader
        title="方案"
        hint={copy.hint}
        aside={
          canCluster && (
            <button
              type="button"
              onClick={() => onReorder(clustered)}
              className="px-2 py-0.5 rounded-md text-violet-text hover:bg-[rgba(124,124,245,.14)] cursor-pointer transition-colors duration-150"
              title="把同一来源文件的方案排到一起"
            >
              按来源分组
            </button>
          )
        }
      />

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
          {ordered.map(p => (
            <Card
              key={p.id}
              p={p}
              {...meta.get(p.id)!}
              drag={dragFor(p.id)}
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
