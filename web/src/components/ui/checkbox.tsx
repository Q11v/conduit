import type { ComponentProps } from 'react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { Check } from '@/components/Icons'
import { cn } from '@/lib/utils'

const TONE = {
  violet:
    'data-[state=checked]:bg-linear-[150deg,var(--color-violet-hi),var(--color-violet-lo)] data-[state=indeterminate]:bg-linear-[150deg,var(--color-violet-hi),var(--color-violet-lo)]',
  cyan: 'data-[state=checked]:bg-linear-[150deg,var(--color-cyan),var(--color-cyan-lo)] data-[state=indeterminate]:bg-linear-[150deg,var(--color-cyan),var(--color-cyan-lo)]'
}

function Checkbox({
  className,
  tone = 'violet',
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> & { tone?: keyof typeof TONE }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'flex shrink-0 items-center justify-center w-[17px] h-[17px] p-0 rounded-[5px] border cursor-pointer transition-all duration-150',
        'border-input bg-transparent data-[state=checked]:border-transparent data-[state=indeterminate]:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-45',
        TONE[tone],
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center">
        {props.checked === 'indeterminate' ? <span className="w-[9px] h-[2px] rounded-full bg-white" /> : <Check />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
