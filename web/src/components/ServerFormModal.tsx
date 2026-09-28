import { useState } from 'react'
import { ServerForm } from './ServerForm'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { ServerDraft } from '../types'
import type { FormMode, Status } from '../useConduit'

interface Props {
  mode: FormMode
  draft: ServerDraft
  msg: Status | null
  keychain: boolean
  hosts: string[]
  tags: string[]
  onChange: (patch: Partial<ServerDraft>) => void
  onClose: () => void
  onCheck: () => void
  onSubmit: () => void
}

export function ServerFormModal(p: Props) {
  const [shown, setShown] = useState<FormMode>(p.mode)
  if (p.mode !== null && p.mode !== shown) setShown(p.mode)

  return (
    <Dialog
      open={p.mode !== null}
      onOpenChange={next => {
        if (!next) p.onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={e => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).querySelector('input')?.focus()
        }}
      >
        {shown !== null && (
          <ServerForm
            mode={shown}
            draft={p.draft}
            msg={p.msg}
            keychain={p.keychain}
            hosts={p.hosts}
            tags={p.tags}
            onChange={p.onChange}
            onClose={p.onClose}
            onCheck={p.onCheck}
            onSubmit={p.onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
