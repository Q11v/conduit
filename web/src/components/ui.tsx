import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Close } from './Icons'
import { PROBE } from '../probe'
import type { Probe } from '../types'

type BtnVariant = 'ghost' | 'primary' | 'violet' | 'cyan'

const VARIANT: Record<BtnVariant, string> = {
  ghost: 'border hair-3 bg-[rgba(255,255,255,.06)] text-fg-soft hover:bg-[rgba(255,255,255,.12)] hover:text-white',
  primary:
    'border-0 bg-linear-[150deg,var(--color-violet-btn),var(--color-violet-lo)] text-white font-medium hover:brightness-90',
  violet:
    'border border-[rgba(124,124,245,.4)] bg-[rgba(124,124,245,.14)] text-violet-text font-medium hover:bg-[rgba(124,124,245,.24)] hover:text-white',
  cyan: 'border-0 bg-linear-[150deg,var(--color-cyan),var(--color-cyan-lo)] text-cyan-ink font-bold hover:brightness-105'
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  children: ReactNode
}

export function Btn({ variant = 'ghost', className = '', children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`shrink-0 whitespace-nowrap rounded-[9px] cursor-pointer transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean
  children: ReactNode
}

export function IconBtn({ danger, className = '', children, ...rest }: IconBtnProps) {
  return (
    <button
      {...rest}
      className={`flex shrink-0 items-center justify-center p-0 border-0 rounded-[7px] bg-transparent text-mute-3 cursor-pointer transition-all duration-150 ${
        danger
          ? 'hover:bg-[rgba(226,86,86,.16)] hover:text-err-text'
          : 'hover:bg-[rgba(255,255,255,.1)] hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  mono,
  ...rest
}: { label: string; mono?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block min-w-0">
      <span className="block text-[12px] text-mute-2 mb-[5px]">{label}</span>
      <input
        {...rest}
        className={`w-full h-9 px-[11px] rounded-[9px] border field-edge sunken text-fg outline-0 focus:border-[rgba(124,124,245,.7)] ${
          mono ? 'font-mono text-[13px]' : 'text-[13px]'
        }`}
      />
    </label>
  )
}

export function SectionHeader({
  step,
  title,
  hint,
  aside
}: {
  step?: string
  title: string
  hint?: string
  aside?: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mb-4">
      {step && <span className="shrink-0 font-mono text-[12px] tracking-[.12em] text-violet-text/70">{step}</span>}
      <span className="shrink-0 text-[17px] font-bold tracking-[-0.01em]">{title}</span>
      {hint && <span className="text-[13px] leading-snug text-mute-2">{hint}</span>}
      {aside && (
        <>
          <span className="flex-1" />
          <span className="shrink-0 whitespace-nowrap text-xs text-mute-3">{aside}</span>
        </>
      )}
    </div>
  )
}

export function StepLabel({
  step,
  title,
  count,
  hint,
  aside
}: {
  step?: string
  title: string
  count?: ReactNode
  hint?: string
  aside?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 min-w-0 min-h-5 mb-2">
      {step && <span className="shrink-0 font-mono text-[12px] tracking-[.12em] text-violet-text/70">{step}</span>}
      <span className="shrink-0 text-[13px] font-semibold text-fg">{title}</span>
      {count}
      {hint && <span className="min-w-0 truncate text-[12px] text-mute-3">{hint}</span>}
      {aside && (
        <>
          <span className="flex-1" />
          <span className="shrink-0 text-[12px] text-mute-3">{aside}</span>
        </>
      )}
    </div>
  )
}

export function CountBadge({ n, total }: { n: number; total?: number }) {
  return (
    <span className="shrink-0 min-w-5 px-1.5 rounded-md bg-[rgba(124,124,245,.18)] text-center font-mono text-[12px] leading-5 text-violet-text">
      {n}
      {total != null && <span className="text-violet-text/55"> / {total}</span>}
    </span>
  )
}

export function ProbeBadge({ probe, title, className = '' }: { probe: Probe; title?: string; className?: string }) {
  const pr = PROBE[probe]
  return (
    <span
      title={title}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] ${className}`}
      style={{ color: pr.fg }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${pr.anim}`} style={{ background: pr.dot }} />
      {pr.label}
    </span>
  )
}

const CHIP_TONE = {
  on: 'border-[rgba(124,124,245,.45)] bg-[rgba(124,124,245,.14)] text-violet-text',
  off: 'hair-2 bg-[rgba(255,255,255,.03)] text-mute-2 hover:text-fg-dim hover:border-[rgba(255,255,255,.2)]'
}

export function Chip({
  active,
  size = 'sm',
  onClick,
  onRemove,
  removeTitle = '移除',
  title,
  dot,
  children
}: {
  dot?: string
  active?: boolean
  size?: 'sm' | 'md'
  onClick?: () => void
  onRemove?: () => void
  removeTitle?: string
  title?: string
  children: ReactNode
}) {
  const box = size === 'md' ? 'h-9 px-2.5 rounded-[9px]' : 'h-6 px-2 rounded-md'
  if (!onClick && !onRemove) {
    return (
      <span
        title={title}
        className={`flex min-w-0 max-w-full shrink-0 items-center gap-1.5 border font-mono text-[12px] hair-2 bg-[rgba(255,255,255,.03)] text-fg-dim ${box}`}
      >
        {dot && <span className="shrink-0 w-1.5 h-1.5 rounded-full transition-colors" style={{ background: dot }} />}
        <span className="min-w-0 truncate">{children}</span>
      </span>
    )
  }
  if (onRemove) {
    return (
      <span
        title={title}
        className={`flex min-w-0 max-w-full shrink-0 items-center gap-1 pr-0.5 border font-mono text-[12px] ${box} ${CHIP_TONE.off} text-fg-dim`}
      >
        <span className="min-w-0 truncate">{children}</span>
        <IconBtn onClick={onRemove} className="w-[18px] h-[18px] rounded" title={removeTitle}>
          <Close size={10} />
        </IconBtn>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex shrink-0 items-center border font-mono text-[12px] whitespace-nowrap cursor-pointer transition-colors duration-150 ${box} ${
        active ? CHIP_TONE.on : CHIP_TONE.off
      }`}
    >
      {children}
    </button>
  )
}

export function StatusLine({ status, className = '' }: { status: { text: string; bad: boolean }; className?: string }) {
  return (
    <div
      className={`min-w-0 text-[13px] leading-snug ${className}`}
      style={{ color: status.bad ? 'var(--color-err-text)' : 'var(--color-mute-2)' }}
    >
      {status.text}
    </div>
  )
}

export function PrimaryAction({
  live,
  onClick,
  className = '',
  children
}: {
  live: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={!live}
      className={`flex shrink-0 items-center justify-center gap-2 px-5 py-2 border-0 rounded-[10px] text-[13px] font-semibold whitespace-nowrap transition-[filter] duration-150 enabled:hover:brightness-90 ${className}`}
      style={{
        background: live
          ? 'linear-gradient(150deg,var(--color-violet-btn),var(--color-violet-lo))'
          : 'rgba(255,255,255,.07)',
        color: live ? '#fff' : 'var(--color-mute-4)',
        cursor: live ? 'pointer' : 'default',
        boxShadow: live ? '0 4px 20px rgba(124,105,245,.36)' : 'none'
      }}
    >
      {children}
    </button>
  )
}
