import type { Probe } from './types'

export const PROBE: Record<Probe, { label: string; dot: string; fg: string; anim: string }> = {
  ok: { label: '连通', dot: 'var(--color-ok)', fg: 'var(--color-ok-text)', anim: '' },
  testing: { label: '检测中', dot: 'var(--color-warn)', fg: 'var(--color-warn-text)', anim: 'animate-cdt-pulse' },
  fail: { label: '失败', dot: 'var(--color-err)', fg: 'var(--color-err-text)', anim: '' },
  idle: { label: '未检测', dot: 'var(--color-mute-4)', fg: 'var(--color-mute-3)', anim: '' }
}

export const probeOf = (probes: Record<string, Probe>, id: string): Probe => probes[id] ?? 'idle'
