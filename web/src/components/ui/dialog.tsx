import { useRef, type ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Close } from '@/components/Icons'
import { cn } from '@/lib/utils'

function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-[rgba(4,4,7,.6)] backdrop-blur-[3px]',
        'data-[state=open]:animate-cdt-fade data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  const returnTo = useRef<HTMLElement | null>(null)

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-focus-ring="none"
        onOpenAutoFocus={e => {
          returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          onOpenAutoFocus?.(e)
        }}
        onEscapeKeyDown={e => {
          onEscapeKeyDown?.(e)
          if (e.target instanceof Element && e.target.closest('[aria-expanded="true"]')) e.preventDefault()
        }}
        onCloseAutoFocus={e => {
          onCloseAutoFocus?.(e)
          if (e.defaultPrevented) return
          e.preventDefault()
          if (returnTo.current?.isConnected) returnTo.current.focus()
        }}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-40px)] max-w-[520px] max-h-[calc(100vh-40px)] overflow-auto',
          'bg-card text-card-foreground border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,.6)] outline-none',
          'data-[state=open]:animate-cdt-pop data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=closed]:duration-150',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="关闭"
            className="absolute top-4 right-[18px] flex items-center justify-center w-7 h-7 p-0 border-0 rounded-lg bg-transparent text-muted-foreground cursor-pointer transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
          >
            <Close size={13} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex items-center gap-2 px-[18px] py-4 border-b hair', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('m-0 text-[15px] font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-[13px] text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
}
