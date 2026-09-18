import { Github, List, Logo } from './Icons'
import { REPO } from '@/lib/links'
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

const Group = ({ children }: { children: React.ReactNode }) => (
  <div className="flex shrink-0 gap-[2px] p-[3px] rounded-[10px] bg-[rgba(255,255,255,.05)] border hair">
    {children}
  </div>
)

const Tab = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-[13px] py-[5px] border-0 rounded-[7px] text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-150 ${
      active ? 'bg-[rgba(124,124,245,.22)] text-white' : 'bg-transparent text-mute hover:text-fg-dim'
    }`}
  >
    {children}
  </button>
)

export function TopBar({ view, onView }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-[rgba(8,8,12,.82)] backdrop-blur-[14px] border-b hair">
      <div className="max-w-[1000px] mx-auto flex items-center gap-[14px] px-5 py-3">
        <div className="flex shrink-0 items-center gap-[9px]">
          <span className="flex items-center justify-center w-[26px] h-[26px] rounded-lg bg-linear-[150deg,var(--color-violet-hi),var(--color-violet-lo)] shadow-[0_3px_14px_rgba(124,105,245,.4)]">
            <Logo />
          </span>
          <span className="hidden sm:inline text-[15px] font-semibold tracking-[-0.01em]">Conduit</span>
        </div>

        <Group>
          {MAIN.map(t => (
            <Tab key={t.id} active={view === t.id} onClick={() => onView(t.id)}>
              {t.label}
            </Tab>
          ))}
        </Group>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => onView('log')}
            title="活动记录"
            aria-label="活动记录"
            aria-current={view === 'log' ? 'page' : undefined}
            className={`flex items-center justify-center w-8 h-8 p-0 border-0 rounded-[9px] cursor-pointer transition-all duration-150 ${
              view === 'log'
                ? 'bg-[rgba(124,124,245,.22)] text-white'
                : 'bg-transparent text-mute hover:bg-[rgba(255,255,255,.08)] hover:text-fg-dim'
            }`}
          >
            <List />
          </button>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer noopener"
            title="GitHub"
            aria-label="GitHub"
            className="flex items-center justify-center w-8 h-8 rounded-[9px] text-mute no-underline transition-all duration-150 hover:bg-[rgba(255,255,255,.08)] hover:text-fg-dim"
          >
            <Github />
          </a>
        </div>
      </div>
    </header>
  )
}
