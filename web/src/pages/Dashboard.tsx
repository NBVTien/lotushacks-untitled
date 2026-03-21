import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScoreRing } from '@/components/ui/score-ring'
import { PageHeader } from '@/components/ui/page-header'
import { PageTransition, FadeIn } from '@/components/ui/motion'
import { Briefcase, Users, BarChart3, CheckCircle, ArrowRight } from 'lucide-react'
import { jobsApi } from '@/lib/api'
import type { JobStats } from '@/lib/api'

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const from = 0
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate)
      }
    }
    ref.current = requestAnimationFrame(animate)
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current)
    }
  }, [value, duration])

  return <>{display}</>
}

const PIPELINE_COLORS: Record<string, string> = {
  uploaded: 'bg-gray-400',
  parsed: 'bg-blue-400',
  enriching: 'bg-violet-400',
  scoring: 'bg-amber-400',
  completed: 'bg-emerald-500',
}

const PIPELINE_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  parsed: 'Parsed',
  enriching: 'Enriching',
  scoring: 'Scoring',
  completed: 'Completed',
}

function PipelineBar({ breakdown }: { breakdown: JobStats['pipelineBreakdown'] }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (total === 0) {
    return <div className="h-3 w-full rounded-full bg-muted" />
  }
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {Object.entries(breakdown).map(([stage, count]) => {
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={stage}
              className={`${PIPELINE_COLORS[stage]} transition-all duration-700`}
              style={{ width: `${pct}%` }}
              title={`${PIPELINE_LABELS[stage]}: ${count}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(breakdown).map(([stage, count]) => (
          <span key={stage} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${PIPELINE_COLORS[stage]}`} />
            {PIPELINE_LABELS[stage]} {count}
          </span>
        ))}
      </div>
    </div>
  )
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/40 bg-card p-4 shadow-card space-y-3">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const [stats, setStats] = useState<JobStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    setStatsLoading(true)
    jobsApi
      .stats()
      .then((data) => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch(() => {
        setStatsLoading(false)
      })
  }, [])

  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Overview of your recruitment pipeline"
        />

        {/* Stats Cards */}
        {statsLoading ? (
          <StatsCardsSkeleton />
        ) : stats && stats.totalJobs > 0 ? (
          <FadeIn>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {/* Card 1: Total Jobs */}
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" />
                  Total Jobs
                </div>
                <p className="mt-1 text-2xl font-semibold">
                  <AnimatedNumber value={stats.totalJobs} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-medium">{stats.activeJobs}</span> active
                </p>
              </div>

              {/* Card 2: Total Candidates */}
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Candidates
                </div>
                <p className="mt-1 text-2xl font-semibold">
                  <AnimatedNumber value={stats.totalCandidates} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  across all jobs
                </p>
              </div>

              {/* Card 3: Avg Score */}
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Avg Score
                </div>
                <div className="mt-1 flex items-center gap-3">
                  {stats.avgScore > 0 ? (
                    <ScoreRing score={stats.avgScore} size={56} strokeWidth={4} />
                  ) : (
                    <span className="text-sm text-muted-foreground">No scores yet</span>
                  )}
                </div>
              </div>

              {/* Card 4: Pipeline Summary */}
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Pipeline
                </div>
                <div className="mt-2">
                  <PipelineBar breakdown={stats.pipelineBreakdown} />
                </div>
              </div>
            </div>
          </FadeIn>
        ) : null}

        {/* Recent Activity */}
        {stats && stats.totalJobs > 0 && (
          <FadeIn>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Pipeline breakdown across all candidates
                  </p>
                  <div className="space-y-2.5">
                    {Object.entries(stats.pipelineBreakdown).map(([stage, count]) => (
                      <div key={stage} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${PIPELINE_COLORS[stage]}`}
                          />
                          <span className="text-sm">{PIPELINE_LABELS[stage]}</span>
                        </div>
                        <span className="text-sm font-medium tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* Quick Actions */}
        <FadeIn>
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Quick Actions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link to="/jobs">
                <Card className="group shadow-sm border-border/50 transition-shadow duration-200 hover:shadow-md cursor-pointer">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">View all jobs</p>
                        <p className="text-xs text-muted-foreground">
                          Manage job postings and candidates
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
