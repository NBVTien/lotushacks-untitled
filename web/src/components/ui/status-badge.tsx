import { cn } from '@/lib/utils'

const statusConfig: Record<string, { color: string; label: string; animate?: boolean }> = {
  uploaded: {
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    label: 'Uploaded',
  },
  parsed: {
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    label: 'Parsed',
  },
  enriching: {
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    label: 'Enriching',
    animate: true,
  },
  enriched: {
    color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    label: 'Enriched',
  },
  scoring: {
    color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    label: 'Scoring',
    animate: true,
  },
  completed: {
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    label: 'Completed',
  },
  error: { color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', label: 'Error' },
}

const recommendationConfig: Record<string, { color: string; label: string }> = {
  strong_match: {
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    label: 'Strong Match',
  },
  good_match: {
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    label: 'Good Match',
  },
  partial_match: {
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    label: 'Partial Match',
  },
  weak_match: {
    color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    label: 'Weak Match',
  },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { color: 'bg-muted text-muted-foreground', label: status }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.animate && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </span>
  )
}

interface RecommendationBadgeProps {
  recommendation: string
  className?: string
}

export function RecommendationBadge({ recommendation, className }: RecommendationBadgeProps) {
  const config = recommendationConfig[recommendation] || {
    color: 'bg-muted text-muted-foreground',
    label: recommendation,
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}
