import type { ComponentProps } from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'h-7 px-2.5 border rounded-md text-[12px] whitespace-nowrap cursor-pointer transition-colors duration-150',
        'border-border bg-[rgba(255,255,255,.03)] text-mute-2 hover:text-fg-dim hover:border-[rgba(255,255,255,.2)]',
        'data-[state=on]:border-[rgba(124,124,245,.5)] data-[state=on]:bg-[rgba(124,124,245,.16)] data-[state=on]:text-violet-text',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-mute-2 disabled:hover:border-border',
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
