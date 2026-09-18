import { Github } from './Icons'
import { REPO } from '@/lib/links'

export function Footer() {
  return (
    <footer className="border-t hair">
      <div className="max-w-[1000px] mx-auto flex items-center gap-4 flex-wrap px-5 py-4 text-[12px] text-mute-3">
        <span>Conduit · 仅监听本机 127.0.0.1，配置只留在这台机器</span>
        <div className="flex-1" />
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer noopener"
          className="flex shrink-0 items-center gap-1.5 text-mute-3 no-underline hover:text-fg-dim"
        >
          <Github />
          GitHub
        </a>
      </div>
    </footer>
  )
}
