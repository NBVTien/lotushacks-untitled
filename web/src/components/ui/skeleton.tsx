import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-muted rounded-md', className)} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

/** Matches the job card layout on Jobs page: title + status dot, description lines, footer meta */
export function JobCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm space-y-4">
      {/* Header: status dot + title + badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full shrink-0" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      {/* Description lines */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      {/* Footer: requirements count + candidates */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

/** Matches the candidate table rows on JobDetail page */
export function CandidateListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Candidate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              Score
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              Recommendation
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="px-4 py-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-5 w-20 rounded-full" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="ml-auto h-4 w-8" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="ml-auto h-5 w-24 rounded-full" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Matches the candidate detail page: pipeline stepper + score ring + info card + tabs */
export function CandidateDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Back link */}
      <Skeleton className="h-4 w-32" />

      {/* Pipeline stepper */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-2.5 w-12" />
            </div>
            {i < 4 && <Skeleton className="mx-1 mb-4 h-0.5 flex-1" />}
          </div>
        ))}
      </div>

      {/* Header grid: score ring + info */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Score ring placeholder */}
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-6 shadow-sm">
          <Skeleton className="h-[130px] w-[130px] rounded-full" />
          <Skeleton className="mt-3 h-5 w-24 rounded-full" />
        </div>

        {/* Candidate info */}
        <div className="md:col-span-2 rounded-xl border bg-card p-6 shadow-sm space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tabs placeholder */}
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-md" />
          ))}
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}

/** Job detail page skeleton: back link + header + tabs + description card */
export function JobDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Back link */}
      <Skeleton className="h-4 w-28" />

      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Description card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Requirements */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
