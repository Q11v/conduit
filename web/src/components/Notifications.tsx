import { useEffect, useSyncExternalStore } from 'react'
import { Close } from './Icons'
import { dismissNotice, getNotices, subscribeNotices, type Notice } from '../lib/notifications'

function Toast({ notice }: { notice: Notice }) {
  useEffect(() => {
    if (notice.tone === 'error') return
    const timer = window.setTimeout(() => dismissNotice(notice.id), 5000)
    return () => window.clearTimeout(timer)
  }, [notice.id, notice.tone])
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      className={`pointer-events-auto relative flex items-start gap-2.5 rounded-xl border bg-card p-3 pr-10 shadow-[var(--floating-shadow)] ${notice.tone === 'error' ? 'border-err/35' : 'hair-3'}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-bold ${notice.tone === 'error' ? 'bg-err/10 text-err-text' : 'bg-violet/10 text-violet-text'}`}
      >
        {notice.tone === 'error' ? '!' : 'i'}
      </span>
      <p className="m-0 max-h-48 min-w-0 overflow-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg-dim select-text">
        {notice.message}
      </p>
      <button
        type="button"
        aria-label="关闭提示"
        title="关闭提示"
        onClick={() => dismissNotice(notice.id)}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-mute hover:bg-fg/5 hover:text-fg cursor-pointer"
      >
        <Close size={12} />
      </button>
    </div>
  )
}

export function Notifications() {
  const notices = useSyncExternalStore(subscribeNotices, getNotices, getNotices)
  return (
    <aside
      aria-label="通知"
      className="pointer-events-none fixed right-4 top-16 z-[80] flex w-[min(420px,calc(100vw-32px))] flex-col gap-2"
    >
      {notices.map(notice => (
        <Toast key={notice.id} notice={notice} />
      ))}
    </aside>
  )
}
