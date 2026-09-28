import { useMemo, useRef, useState } from 'react'
import { ArrowUp, FileIcon, Upload } from './Icons'
import { Btn, Chip, CountBadge, PrimaryAction, ProbeBadge, StatusLine, StepLabel } from './ui'
import { Checkbox } from '@/components/ui/checkbox'
import { TargetPicker } from './TargetPicker'
import { formatSize } from '../api'
import type { Probe, SelectedTarget, Server } from '../types'
import type { Status } from '../useConduit'

interface Props {
  src: string
  size: number | null
  staging: { name: string; pct: number } | null
  onSrc: (v: string) => void
  onFile: (f: File) => void

  selected: SelectedTarget[]
  adhocTargets: string[]
  totalTargets: number
  probeOf: (serverId: string) => Probe
  onToggle: (key: string) => void
  onRemoveAdhoc: (spec: string) => void

  groups: { name: string; label: string; servers: Server[] }[]
  sel: Set<string>
  onToggleDir: (serverId: string, dir: string) => void
  onToggleGroup: (name: string) => void
  adhoc: string
  onAdhoc: (v: string) => void
  onGoServers: () => void

  status: Status
  ready: boolean
  busy: boolean
  verify: boolean
  onToggleVerify: () => void
  onPush: () => void
  onSave: () => void
}

const Pill = ({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'violet' }) => (
  <span
    className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[12px] ${
      tone === 'violet' ? 'bg-[rgba(124,124,245,.18)] text-violet-text' : 'bg-[rgba(255,255,255,.08)] text-fg-dim'
    }`}
  >
    {children}
  </span>
)

export function PushCard(p: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const targetCount = p.selected.length + p.adhocTargets.length
  const live = p.ready && !p.busy
  const fileName = p.src.split('/').filter(Boolean).pop() || ''

  const byServer = useMemo(() => {
    const m = new Map<string, { server: Server; items: SelectedTarget[] }>()
    for (const t of p.selected) {
      const hit = m.get(t.server.id)
      if (hit) hit.items.push(t)
      else m.set(t.server.id, { server: t.server, items: [t] })
    }
    return [...m.values()]
  }, [p.selected])

  return (
    <section className="border hair-2 rounded-2xl panel mb-7">
      <div className="grid items-start gap-x-3 gap-y-4 p-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div
          className="min-w-0"
          onDragOver={e => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
          }}
          onDrop={e => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) p.onFile(f)
          }}
        >
          <StepLabel step="01" title="本地来源" hint="填路径、点「选择」或拖进来" />
          <div
            className={`relative flex items-center gap-3 px-3.5 py-2.5 border rounded-xl overflow-hidden transition-all duration-150 ${
              over
                ? 'border-dashed border-[rgba(124,124,245,.7)] bg-[rgba(124,124,245,.08)]'
                : 'field-edge sunken focus-within:border-[rgba(124,124,245,.7)]'
            }`}
          >
            <FileIcon size={17} className="shrink-0 text-mute-3" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span
                  className={`min-w-0 truncate text-[13.5px] font-semibold ${fileName ? 'text-fg' : 'text-mute-4'}`}
                >
                  {fileName || '未选择来源'}
                </span>
                {p.staging ? (
                  <Pill tone="violet">暂存中 {p.staging.pct}%</Pill>
                ) : (
                  p.size != null && <Pill>{formatSize(p.size)}</Pill>
                )}
              </div>
              <input
                value={p.src}
                onChange={e => p.onSrc(e.target.value)}
                placeholder="/Users/you/dist/app-1.2.0.tar.gz"
                spellCheck={false}
                data-focus-ring="none"
                className="w-full mt-0.5 border-0 outline-none bg-transparent font-mono text-[12px] text-mute-3 focus:text-fg-dim"
              />
            </div>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="shrink-0 whitespace-nowrap px-[11px] py-[5px] border hair-3 rounded-lg bg-[rgba(255,255,255,.06)] text-fg-soft text-xs cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,.12)] hover:text-white"
            >
              选择
            </button>

            {p.staging && (
              <div
                className="absolute left-0 bottom-0 h-[2px] bg-linear-[90deg,var(--color-violet-hi),var(--color-cyan)] transition-[width] duration-200"
                style={{ width: `${p.staging.pct}%` }}
              />
            )}

            {over && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[rgba(26,26,44,.95)] text-violet-text text-[13px] pointer-events-none">
                <Upload className="shrink-0" />
                松开即可添加
              </div>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) p.onFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <span className="hidden md:flex items-center h-[58px] mt-7 text-mute-4">→</span>

        <div className="min-w-0">
          <StepLabel
            step="02"
            title="目标服务器"
            count={<CountBadge n={targetCount} total={p.totalTargets} />}
            hint={p.adhocTargets.length > 0 ? `含 ${p.adhocTargets.length} 个临时目标` : undefined}
          />

          <div className="flex flex-col gap-1.5">
            {byServer.map(({ server, items }) => (
              <div
                key={server.id}
                className="flex items-center gap-x-3 gap-y-1.5 flex-wrap px-3 py-2 border hair-2 rounded-xl bg-[rgba(0,0,0,.3)]"
              >
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="text-[13px] font-medium whitespace-nowrap">{server.name}</span>
                  <ProbeBadge probe={p.probeOf(server.id)} />
                </span>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {items.map(t => (
                    <Chip key={t.key} onRemove={() => p.onToggle(t.key)} removeTitle="移出本次推送">
                      {t.dir}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}

            {p.adhocTargets.length > 0 && (
              <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap px-3 py-2 border hair-2 rounded-xl bg-[rgba(0,0,0,.3)]">
                <span className="flex shrink-0 items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
                  <span className="text-[13px] font-medium whitespace-nowrap">临时目标</span>
                </span>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {p.adhocTargets.map(spec => (
                    <Chip key={spec} onRemove={() => p.onRemoveAdhoc(spec)} removeTitle="移出本次推送">
                      {spec}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className={targetCount === 0 ? '' : 'mt-0.5'}>
              <TargetPicker
                groups={p.groups}
                sel={p.sel}
                totalTargets={p.totalTargets}
                probeOf={p.probeOf}
                adhoc={p.adhoc}
                onToggle={p.onToggleDir}
                onToggleGroup={p.onToggleGroup}
                onAdhoc={p.onAdhoc}
                onGoServers={p.onGoServers}
                empty={targetCount === 0}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-t hair bg-[rgba(255,255,255,.02)] rounded-b-2xl">
        <label className="flex shrink-0 items-center gap-2 text-[13px] text-fg-dim cursor-pointer select-none hover:text-fg">
          <Checkbox checked={p.verify} onCheckedChange={p.onToggleVerify} />
          <span className="whitespace-nowrap">推送后校验大小</span>
        </label>

        <StatusLine status={p.status} className="flex-1 min-w-[6rem] truncate" />

        <Btn onClick={p.onSave} className="px-3.5 py-2 text-[13px] font-medium rounded-[10px]">
          存为方案
        </Btn>

        <PrimaryAction live={live} onClick={p.onPush}>
          <ArrowUp />
          {p.busy ? '推送中…' : p.ready ? `推送 ${targetCount} 个目标` : '推送'}
        </PrimaryAction>
      </div>
    </section>
  )
}
