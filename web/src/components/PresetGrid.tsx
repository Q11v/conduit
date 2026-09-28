import { Doc, Trash } from './Icons'
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
    if (!dir || !s.dirs.includes(dir)) return null
    return `${s.host}${s.port ? ':' + s.port : ''}:${dir}`
  })
  const alive = resolved.filter((x): x is string => x !== null)
  const missing = resolved.length - alive.length
  const targets = [...alive, ...p.adhoc]
  return {
    count: `${targets.length} 个目标`,
    broken: missing > 0 ? `${missing} 个已失效` : null,
    rows: [
      ['来源', p.src || none('每次推送前选择')],
      ['目标', targets.length ? targets.join('、') : none('无')]
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
      ['路径', p.paths.join('、')],
      ['本地', p.localDir]
    ]
  }
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
    <span className="flex-1 min-w-0 font-mono text-[12px] leading-relaxed text-fg-dim break-all">{children}</span>
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
