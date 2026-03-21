import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 py-20"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="mt-5 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-center text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6 gap-2">
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}
