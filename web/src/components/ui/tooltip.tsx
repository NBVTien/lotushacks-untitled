import * as React from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = BaseTooltip.Provider

function Tooltip({ children, ...props }: React.ComponentProps<typeof BaseTooltip.Root>) {
  return <BaseTooltip.Root {...props}>{children}</BaseTooltip.Root>
}

function TooltipTrigger({
  className,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Trigger>) {
  return <BaseTooltip.Trigger className={cn(className)} {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Popup> & { sideOffset?: number }) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset}>
        <BaseTooltip.Popup
          className={cn(
            'z-50 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md animate-fade-in',
            className
          )}
          {...props}
        >
          {children}
          <BaseTooltip.Arrow className="fill-foreground" />
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
