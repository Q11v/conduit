import { useRef } from 'react'
import { Close } from './Icons'
import { Btn, IconBtn } from './ui'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Status } from '../useConduit'

interface Props {
  open: boolean
  name: string
  placeholder: string
  primary: string
  secondary: string
  blocked: string | null
  relink?: boolean
  onToggleRelink?: () => void
  msg: Status | null
  onName: (v: string) => void
  onSave: () => void
  onClose: () => void
}

export function SavePresetModal({
  open,
  name,
  placeholder,
  primary,
  secondary,
  blocked,
  relink,
  onToggleRelink,
  msg,
  onName,
  onSave,
  onClose
}: Props) {
  const nameRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={e => {
          e.preventDefault()
          nameRef.current?.focus()
        }}
        className="max-w-[440px] border-[rgba(106,213,230,.32)] [--focus-ring:var(--color-cyan)]"
      >
        <DialogHeader>
          <DialogTitle className="flex-1">存为方案</DialogTitle>
          <DialogClose asChild>
            <IconBtn aria-label="关闭" className="w-7 h-7 rounded-lg">
              <Close size={13} />
            </IconBtn>
          </DialogClose>
        </DialogHeader>

        <div className="p-[18px]">
          <input
            ref={nameRef}
            value={name}
            onChange={e => onName(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 mb-2.5 px-[11px] rounded-[9px] border field-edge sunken text-[13px] text-fg outline-0 focus:border-[rgba(106,213,230,.7)]"
          />

          <div className="px-3 py-2.5 mb-2.5 border hair-2 rounded-[10px] bg-[rgba(0,0,0,.3)]">
            <div className="text-[12px] text-mute-2 mb-1">会记住</div>
            <div className="font-mono text-[12px] text-fg-dim break-all whitespace-pre-line">{primary}</div>
            <div className="mt-1.5 text-[12px] text-mute-2 break-words">{secondary}</div>
          </div>

          {onToggleRelink && (
            <label className="flex items-start gap-[9px] w-full mb-3 cursor-pointer select-none">
              <Checkbox checked={!!relink} onCheckedChange={onToggleRelink} tone="cyan" className="mt-px" />
              <span className="min-w-0 text-xs leading-relaxed text-fg-dim">每次推送前重新选来源，只记住目标</span>
            </label>
          )}

          <Btn
            variant="cyan"
            onClick={onSave}
            disabled={blocked !== null}
            className={`w-full py-2 text-[13px] rounded-[10px] ${onToggleRelink ? '' : 'mt-0.5'}`}
          >
            保存方案
          </Btn>

          {blocked && <p className="mt-2 text-[12px] text-mute-2">{blocked}</p>}
          {msg && (
            <p
              className="mt-2 text-[12px] leading-relaxed break-words"
              style={{ color: msg.bad ? 'var(--color-err-text)' : 'var(--color-mute-2)' }}
            >
              {msg.text}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
