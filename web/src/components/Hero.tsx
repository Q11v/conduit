interface Props {
  eyebrow: string
  title: string
  desc: string
}

export function Hero({ eyebrow, title, desc }: Props) {
  return (
    <div className="text-center mb-6">
      <div className="font-mono text-[12px] tracking-[.22em] uppercase text-cyan mb-2.5">{eyebrow}</div>
      <h1 className="m-0 mb-2.5 text-[clamp(30px,5vw,44px)] font-bold tracking-[-0.03em] leading-[1.1] bg-linear-[120deg,var(--color-fg)_20%,var(--color-violet-text)_60%,var(--color-cyan)] bg-clip-text text-transparent">
        {title}
      </h1>
      <p className="m-0 text-[14.5px] text-mute">{desc}</p>
    </div>
  )
}
