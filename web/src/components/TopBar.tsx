import { History, Sun, Moon } from './Icons'
import { HeaderLinks } from './HeaderLinks'
import type { HostsInfo } from '../types'
import type { View } from '../useConduit'

interface Props {
  hosts: HostsInfo | null
  theme: 'dark' | 'light'
  onTheme: (theme: 'dark' | 'light') => void
  view: View
  onView: (v: View) => void
}

const MAIN: { id: View; label: string }[] = [
  { id: 'workbench', label: '工作台' },
  { id: 'plans', label: '方案' }
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
      active ? 'bg-fg/8 text-fg' : 'bg-transparent text-mute hover:bg-fg/4 hover:text-fg-dim'
    }`}
  >
    {children}
  </button>
)

export function TopBar({ view, onView, hosts, theme, onTheme }: Props) {
  const integrated = window.desktop?.platform === 'darwin'

  return (
    <header
      className={`shrink-0 sticky top-0 z-20 bg-ink border-b hair select-none ${integrated ? 'desktop-titlebar' : ''}`}
    >
      <div
        className={`relative flex h-[52px] items-center gap-3 pr-4 ${integrated ? 'pl-[96px]' : 'max-w-[1000px] mx-auto pl-5'}`}
      >
        <span
          className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 text-[12px] font-medium tracking-wide text-mute-4 xl:inline"
          aria-hidden="true"
        >
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

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onView('log')}
            title="活动记录"
            aria-label="活动记录"
            aria-current={view === 'log' ? 'page' : undefined}
            className={`flex items-center justify-center gap-1.5 h-8 px-2 rounded-md border-0 text-[12px] cursor-pointer transition-colors duration-150 ${
              view === 'log' ? 'bg-fg/8 text-fg' : 'bg-transparent text-mute hover:bg-fg/4 hover:text-fg-dim'
            }`}
          >
            <History size={14} />
            <span>活动记录</span>
          </button>
          <button
            type="button"
            onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
            title={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] text-mute hover:bg-fg/4 hover:text-fg-dim cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === 'dark' ? '日间' : '夜间'}</span>
          </button>
          <HeaderLinks hosts={hosts} />
        </div>
      </div>
    </header>
  )
}
