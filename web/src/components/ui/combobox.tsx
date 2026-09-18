import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { Check, Chevron } from '@/components/Icons'
import { cn } from '@/lib/utils'

interface ComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  options: string[]
}

function Combobox({ value, onValueChange, options, className, onKeyDown, onBlur, ...props }: ComboboxProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(-1)

  const q = query?.trim().toLowerCase()
  const items = q ? options.filter(o => o.toLowerCase().includes(q)) : options
  const shown = open && items.length > 0

  const show = () => {
    setQuery(null)
    setActive(options.indexOf(value))
    setOpen(true)
  }
  const pick = (v: string) => {
    onValueChange(v)
    setOpen(false)
  }

  useEffect(() => {
    if (shown && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [shown, active, id])

  return (
    <div className="relative">
      <input
        ref={input}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        {...props}
        value={value}
        onChange={e => {
          onValueChange(e.target.value)
          setQuery(e.target.value)
          setActive(-1)
          setOpen(true)
        }}
        onClick={() => {
          if (!open) show()
        }}
        onBlur={e => {
          setOpen(false)
          onBlur?.(e)
        }}
        onKeyDown={e => {
          onKeyDown?.(e)
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!shown) return show()
            const n = items.length
            setActive(i => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1))
          } else if (e.key === 'Enter' && shown && active >= 0) {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === 'Escape' && shown) {
            setOpen(false)
          }
        }}
        className={cn(
          'w-full h-9 pl-[11px] pr-9 rounded-[9px] border field-edge sunken text-[13px] text-fg outline-0 focus:border-[rgba(124,124,245,.7)]',
          className
        )}
      />
      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            if (shown) setOpen(false)
            else show()
            input.current?.focus()
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 p-0 border-0 rounded-[7px] bg-transparent text-mute-3 cursor-pointer hover:bg-[rgba(255,255,255,.1)] hover:text-white"
        >
          <Chevron size={13} className={cn('transition-transform duration-150', shown ? '-rotate-90' : 'rotate-90')} />
        </button>
      )}
      {shown && (
        <ul
          id={`${id}-list`}
          role="listbox"
          onMouseDown={e => e.preventDefault()}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 m-0 p-1 max-h-56 overflow-auto list-none bg-popover border border-[rgba(255,255,255,.2)] rounded-[10px] elevated animate-cdt-pop"
        >
          {items.map((o, i) => (
            <li
              key={o}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o === value}
              onMouseMove={() => setActive(i)}
              onClick={() => pick(o)}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer font-mono text-[13px]',
                i === active ? 'bg-[rgba(255,255,255,.08)] text-fg' : 'text-fg-dim'
              )}
            >
              <span className="flex-1 min-w-0 truncate">{o}</span>
              {o === value && <Check size={11} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { Combobox }
