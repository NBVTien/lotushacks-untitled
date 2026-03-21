import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { MapPin, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { jobsApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 10

export function CareersPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const res = await jobsApi.listPublic(page, PAGE_SIZE)
      setJobs((prev) => [...prev, ...res.data])
      setHasMore(res.hasMore)
      setPage((p) => p + 1)
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [page, loading, hasMore])

  useEffect(() => {
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore, loading])

  return (
    <div className="space-y-12 animate-fade-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-hero px-8 py-16 text-center text-white md:px-16 md:py-20">
        <div className="bg-grid-pattern absolute inset-0 opacity-30" />
        <div className="relative">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Join Our Team
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/80">
            Find your next opportunity. We're looking for passionate people to help us build the future.
          </p>
        </div>
      </div>

      {/* AI Discovery Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <h2 className="text-lg font-semibold">Let AI find the perfect job for you</h2>
            <p className="text-sm text-muted-foreground">
              Enter your skills and let our AI search across ITviec, TopDev, LinkedIn, and more.
            </p>
          </div>
          <Button onClick={() => navigate('/careers/discover')}>
            Discover Jobs
          </Button>
        </CardContent>
      </Card>

      {/* Job listings */}
      {initialLoad ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !initialLoad && jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <MapPin className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No open positions at the moment</p>
          <p className="mt-1 text-xs text-muted-foreground">Check back later for new opportunities</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="group overflow-hidden shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors">
                        {job.title}
                      </h2>
                      {job.company && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{job.company.name}</p>
                      )}
                    </div>

                    {expanded === job.id ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{job.description}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {job.description.replace(/[#*_`\[\]]/g, '').slice(0, 250)}...
                      </p>
                    )}

                    <button
                      onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {expanded === job.id ? 'Show less' : 'Read more'}
                    </button>

                    {job.requirements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {job.requirements.map((r, i) => (
                          <Badge key={i} variant="outline">{r}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {job.company && (
                      <Link to={`/careers/company/${encodeURIComponent(job.company.name)}`}>
                        <Button variant="ghost" size="sm">Research Company</Button>
                      </Link>
                    )}
                    <Link to={`/careers/${job.id}/apply`}>
                      <Button className="gap-1.5">
                        Apply <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="flex justify-center py-4">
        {loading && !initialLoad && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading more...
          </div>
        )}
        {!hasMore && jobs.length > 0 && (
          <p className="text-sm text-muted-foreground">All positions loaded</p>
        )}
      </div>
    </div>
  )
}
