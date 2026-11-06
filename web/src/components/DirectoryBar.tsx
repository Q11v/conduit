import { useRef, useState } from 'react'
import { Chevron, Folder, Pencil } from './Icons'

interface Props {
  title: string
  value: string
  path: string | null
  loading: boolean
  onChange: (value: string) => void
  onGo: (path: string) => void
  onPick?: () => void
}

const action =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-mute cursor-pointer hover:bg-fg/8 hover:text-fg disabled:opacity-35 disabled:cursor-not-allowed'

export function DirectoryBar({ title, value, path, loading, onChange, onGo, onPick }: Props) {
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const segments = (path || '').split('/').filter(Boolean)
  const edit = () => {
    onChange(path ?? value)
    setEditing(true)
  }
  const cancel = () => {
    if (path) onChange(path)
    setEditing(false)
  }

  return (
    <form
      className="flex items-center gap-1.5 border-b hair p-3"
      onSubmit={e => {
        e.preventDefault()
        onGo(value.trim() || '~')
        setEditing(false)
      }}
    >
      <div className="flex h-9 min-w-0 flex-1 items-center gap-1 rounded-lg border hair-2 sunken px-1 focus-within:border-violet/60 focus-within:ring-2 focus-within:ring-violet/60">
        {editing || !path ? (
          <input
            data-focus-ring="none"
            ref={input}
            autoFocus={editing}
            onFocus={e => e.currentTarget.select()}
            aria-label={`${title}目录，回车打开`}
            placeholder="输入路径，按回车打开"
            spellCheck={false}
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={cancel}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-[13px] text-fg outline-none"
          />
        ) : (
          <div
            className="flex h-full min-w-0 flex-1 items-center overflow-x-auto cursor-text"
            onClick={edit}
            title="点击路径空白处输入，回车打开"
          >
            <button
              type="button"
              className="h-7 shrink-0 rounded px-2 text-xs text-mute hover:bg-fg/8 hover:text-fg cursor-pointer"
              aria-label={`${title}根目录`}
              onClick={e => {
                e.stopPropagation()
                onGo('/')
              }}
            >
              /
            </button>
            {segments.map((name, index) => (
              <span key={index} className="flex shrink-0 items-center">
                {index > 0 && <Chevron size={11} className="text-mute-5" />}
                <button
                  type="button"
                  title={`/${segments.slice(0, index + 1).join('/')}`}
                  className={`h-7 max-w-[180px] truncate rounded px-1.5 text-[13px] hover:bg-fg/8 cursor-pointer ${index === segments.length - 1 ? 'text-fg' : 'text-mute'}`}
                  onClick={e => {
                    e.stopPropagation()
                    onGo(`/${segments.slice(0, index + 1).join('/')}`)
                  }}
                >
                  {name}
                </button>
              </span>
            ))}
            <span className="h-full min-w-4 flex-1" />
          </div>
        )}
        {path && !editing && (
          <button
            type="button"
            className={action}
            onClick={edit}
            aria-label={`输入${title}路径`}
            title="输入或粘贴路径，按回车打开"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
      {onPick && (
        <button type="button" className={action} onClick={onPick} title="选择本地目录" aria-label="选择本地目录">
          <Folder size={16} />
        </button>
      )}
      <button
        type="button"
        className={action}
        title={loading ? '读取中…' : '刷新目录'}
        aria-label={`刷新${title}目录`}
        disabled={loading || !path}
        onClick={() => path && onGo(path)}
      >
        <span className={loading ? 'animate-spin' : ''}>↻</span>
      </button>
    </form>
  )
}
