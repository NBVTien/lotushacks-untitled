import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Github, Trophy, AlertTriangle, Star, Code2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageTransition } from '@/components/ui/motion'
import { ScoreRing } from '@/components/ui/score-ring'
import { RecommendationBadge } from '@/components/ui/status-badge'
import { candidatesApi } from '@/lib/api'
import type { Candidate } from '@lotushack/shared'
import { cn } from '@/lib/utils'

export function CandidateComparePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [searchParams] = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || []

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId || ids.length === 0) return
    setLoading(true)
    Promise.all(ids.map((id) => candidatesApi.get(jobId, id)))
      .then((results) => {
        setCandidates(results)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load candidate data.')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, searchParams.get('ids')])

  const highestScore = Math.max(
    ...candidates.map((c) => c.matchResult?.overallScore ?? 0)
  )

  if (!jobId || ids.length < 2) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <Link
            to={`/recruiter/jobs/${jobId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Job
          </Link>
          <p className="text-muted-foreground">
            Select at least 2 candidates to compare.
          </p>
        </div>
      </PageTransition>
    )
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <Link
            to={`/recruiter/jobs/${jobId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Job
          </Link>
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      </PageTransition>
    )
  }

  if (error) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <Link
            to={`/recruiter/jobs/${jobId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Job
          </Link>
          <p className="text-destructive">{error}</p>
        </div>
      </PageTransition>
    )
  }

  // Helpers for relative comparison coloring
  const scores = candidates.map((c) => c.matchResult?.overallScore ?? 0)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)

  function getRelativeClass(value: number, allValues: number[], higherIsBetter = true) {
    if (allValues.length < 2) return ''
    const max = Math.max(...allValues)
    const min = Math.min(...allValues)
    if (max === min) return ''
    if (higherIsBetter) {
      if (value === max) return 'text-emerald-600 dark:text-emerald-400'
      if (value === min) return 'text-red-500 dark:text-red-400'
    } else {
      if (value === min) return 'text-emerald-600 dark:text-emerald-400'
      if (value === max) return 'text-red-500 dark:text-red-400'
    }
    return 'text-amber-600 dark:text-amber-400'
  }

  const colCount = candidates.length
  const gridCols =
    colCount === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-3'

  return (
    <PageTransition>
      <div className="space-y-8">
        <Link
          to={`/recruiter/jobs/${jobId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Job
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Candidate Comparison
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparing {candidates.length} candidates side by side
          </p>
        </div>

        {/* Comparison columns */}
        <div className={cn('grid gap-6', gridCols)}>
          {candidates.map((c) => {
            const score = c.matchResult?.overallScore ?? 0
            const isHighest = score === highestScore && score > 0
            const gh = c.enrichment?.github

            return (
              <div
                key={c.id}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-card shadow-sm transition-shadow',
                  isHighest &&
                    'border-emerald-400 shadow-emerald-100 dark:border-emerald-600 dark:shadow-emerald-900/20 ring-1 ring-emerald-400/30'
                )}
              >
                {/* Winner badge */}
                {isHighest && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                      <Trophy className="h-3 w-3" /> Top Score
                    </span>
                  </div>
                )}

                {/* Header: Name & email */}
                <div className="border-b px-5 pt-6 pb-4">
                  <Link
                    to={`/recruiter/jobs/${jobId}/candidates/${c.id}`}
                    className="text-base font-semibold hover:text-primary transition-colors"
                  >
                    {c.name}
                  </Link>
                  {c.email && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {c.email}
                    </p>
                  )}
                </div>

                {/* Score */}
                <div className="flex flex-col items-center border-b px-5 py-5">
                  {c.matchResult ? (
                    <>
                      <ScoreRing score={score} size={90} strokeWidth={7} />
                      <div className="mt-3">
                        <RecommendationBadge
                          recommendation={c.matchResult.recommendation}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No score yet
                    </p>
                  )}
                </div>

                {/* Strengths */}
                <Section
                  icon={<Star className="h-3.5 w-3.5 text-emerald-500" />}
                  title="Strengths"
                  items={c.matchResult?.strengths}
                  emptyText="No strengths data"
                  itemClass="text-emerald-700 dark:text-emerald-400"
                  bgClass="bg-emerald-50/50 dark:bg-emerald-900/10"
                  allCounts={candidates.map(
                    (cc) => cc.matchResult?.strengths?.length ?? 0
                  )}
                  thisCount={c.matchResult?.strengths?.length ?? 0}
                />

                {/* Gaps */}
                <Section
                  icon={
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  }
                  title="Gaps"
                  items={c.matchResult?.gaps}
                  emptyText="No gaps identified"
                  itemClass="text-amber-700 dark:text-amber-400"
                  bgClass="bg-amber-50/50 dark:bg-amber-900/10"
                  allCounts={candidates.map(
                    (cc) => cc.matchResult?.gaps?.length ?? 0
                  )}
                  thisCount={c.matchResult?.gaps?.length ?? 0}
                  fewerIsBetter
                />

                {/* Skills */}
                <div className="border-b px-5 py-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-blue-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Key Skills
                    </h3>
                  </div>
                  {c.parsedCV?.skills && c.parsedCV.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {c.parsedCV.skills.slice(0, 12).map((skill, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {c.parsedCV.skills.length > 12 && (
                        <Badge variant="outline" className="text-xs">
                          +{c.parsedCV.skills.length - 12}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No skills data
                    </p>
                  )}
                </div>

                {/* GitHub stats */}
                <div className="px-5 py-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Github className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      GitHub
                    </h3>
                  </div>
                  {gh ? (
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <StatCard
                          label="Stars"
                          value={gh.totalStars}
                          className={getRelativeClass(
                            gh.totalStars,
                            candidates
                              .map((cc) => cc.enrichment?.github?.totalStars)
                              .filter((v): v is number => v != null)
                          )}
                        />
                        <StatCard
                          label="Repos"
                          value={gh.repositories.length}
                          className={getRelativeClass(
                            gh.repositories.length,
                            candidates
                              .map(
                                (cc) =>
                                  cc.enrichment?.github?.repositories.length
                              )
                              .filter((v): v is number => v != null)
                          )}
                        />
                      </div>
                      {gh.totalContributions != null && (
                        <StatCard
                          label="Contributions"
                          value={gh.totalContributions}
                          className={getRelativeClass(
                            gh.totalContributions,
                            candidates
                              .map(
                                (cc) =>
                                  cc.enrichment?.github?.totalContributions
                              )
                              .filter((v): v is number => v != null)
                          )}
                        />
                      )}
                      {gh.topLanguages.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Languages
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {gh.topLanguages.slice(0, 6).map((lang) => (
                              <Badge
                                key={lang}
                                variant="outline"
                                className="text-xs"
                              >
                                {lang}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No GitHub data
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Score comparison bar */}
        {candidates.some((c) => c.matchResult) && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Score Overview
            </h2>
            <div className="space-y-3">
              {candidates.map((c) => {
                const score = c.matchResult?.overallScore ?? 0
                const isMax = score === maxScore && score > 0
                return (
                  <div key={c.id} className="flex items-center gap-4">
                    <span className="w-32 truncate text-sm font-medium">
                      {c.name}
                    </span>
                    <div className="relative flex-1 h-6 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          isMax
                            ? 'bg-emerald-500'
                            : score === minScore && maxScore !== minScore
                              ? 'bg-red-400'
                              : 'bg-blue-500'
                        )}
                        style={{ width: `${score}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
                        {score}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  )
}

// --- Sub-components ---

function Section({
  icon,
  title,
  items,
  emptyText,
  itemClass,
  bgClass,
  allCounts,
  thisCount,
  fewerIsBetter = false,
}: {
  icon: React.ReactNode
  title: string
  items?: string[]
  emptyText: string
  itemClass: string
  bgClass: string
  allCounts: number[]
  thisCount: number
  fewerIsBetter?: boolean
}) {
  const maxCount = Math.max(...allCounts)
  const minCount = Math.min(...allCounts)
  const isBest = fewerIsBetter
    ? thisCount === minCount && maxCount !== minCount
    : thisCount === maxCount && maxCount !== minCount

  return (
    <div className="border-b px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">({thisCount})</span>
        {isBest && (
          <span className="ml-auto text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            Best
          </span>
        )}
      </div>
      {items && items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className={cn('rounded-md px-2.5 py-1 text-xs', bgClass)}
            >
              <span className={itemClass}>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold', className)}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
