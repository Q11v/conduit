import { tildify } from '@/lib/paths'

interface Props {
  eyebrow: string
  title: string
  desc: string
  path: string
  home: string
}

export function Hero({ eyebrow, title, desc, path, home }: Props) {
  return (
    <div className="text-center mb-[34px]">
      <div className="font-mono text-[12px] tracking-[.22em] uppercase text-cyan mb-3">{eyebrow}</div>
      <h1 className="m-0 mb-2.5 text-[clamp(30px,5vw,44px)] font-bold tracking-[-0.03em] leading-[1.1] bg-linear-[120deg,#fff_20%,#a9a4ff_60%,var(--color-cyan)] bg-clip-text text-transparent">
        {title}
      </h1>
      <p className="m-0 text-[14.5px] text-mute">{desc}</p>
      {path && (
        <p className="m-0 mt-1 text-[12px] text-mute" title={path}>
          <span className="text-mute">配置文件：</span>
          <span className="font-mono select-all break-all">{tildify(path, home)}</span>
        </p>
      )}
    </div>
  )
}
