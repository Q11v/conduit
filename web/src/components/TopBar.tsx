import { History } from './Icons'
import type { View } from '../useConduit'

interface Props {
  view: View
  onView: (v: View) => void
}

const MAIN: { id: View; label: string }[] = [
  { id: 'servers', label: '服务器' },
  { id: 'push', label: '推送' },
  { id: 'pull', label: '拉取' }
]

const Tab = ({
  active,
  onClick,
  shortcut,
  children
}: {
  active: boolean
  onClick: () => void
  shortcut: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    title={`${children}（${shortcut}）`}
    className={`flex items-center px-3 py-1.5 border-0 rounded-md text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors duration-150 ${
      active ? 'bg-white/8 text-fg' : 'bg-transparent text-mute hover:bg-white/4 hover:text-fg-dim'
    }`}
  >
    {children}
  </button>
)

export function TopBar({ view, onView }: Props) {
  const integrated = window.desktop?.platform === 'darwin'

  return (
    <header className={`sticky top-0 z-20 bg-ink border-b hair select-none ${integrated ? 'desktop-titlebar' : ''}`}>
      <div
        className={`flex h-[52px] items-center gap-6 pr-5 ${integrated ? 'pl-[96px]' : 'max-w-[1000px] mx-auto pl-5'}`}
      >
        <span className="hidden sm:inline-flex h-5 shrink-0 items-center border-r hair-3 pr-6 text-[12px] font-medium tracking-[0.02em] text-mute-4">
          Conduit
        </span>

        <nav aria-label="主导航" className="flex shrink-0 items-center gap-1">
          {MAIN.map((t, index) => (
            <Tab
              key={t.id}
              active={view === t.id}
              shortcut={`${integrated ? '⌘' : 'Ctrl+'}${index + 1}`}
              onClick={() => onView(t.id)}
            >
              {t.label}
            </Tab>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onView('log')}
            title="活动记录"
            aria-label="活动记录"
            aria-current={view === 'log' ? 'page' : undefined}
            className={`flex items-center justify-center gap-1.5 h-8 px-2 rounded-md border-0 text-[12px] cursor-pointer transition-colors duration-150 ${
              view === 'log' ? 'bg-white/8 text-fg' : 'bg-transparent text-mute hover:bg-white/4 hover:text-fg-dim'
            }`}
          >
            <History size={14} />
            <span className="hidden sm:inline">活动记录</span>
          </button>
        </div>
      </div>
    </header>
  )
}
