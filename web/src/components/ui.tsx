import type { ButtonHTMLAttributes, ReactNode } from 'react'
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
