import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  // Initial load
  useEffect(() => {
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Infinite scroll via IntersectionObserver
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
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Open Positions</h1>
        <p className="mt-2 text-muted-foreground">
          Find your next opportunity. Apply with your CV.
        </p>
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

      {!initialLoad && jobs.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No open positions at the moment.
        </p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{job.title}</CardTitle>
                    {job.company && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.company.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {job.company && (
                      <Link to={`/careers/company/${encodeURIComponent(job.company.name)}`}>
                        <Button variant="ghost" size="sm">Research Company</Button>
                      </Link>
                    )}
                    <Link to={`/careers/${job.id}/apply`}>
                      <Button>Apply Now</Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {expanded === job.id ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{job.description}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {job.description.replace(/[#*_`\[\]]/g, '').slice(0, 250)}...
                  </p>
                )}
                <button
                  onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                  className="text-sm text-primary underline"
                >
                  {expanded === job.id ? 'Show less' : 'Read more'}
                </button>
                {job.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {job.requirements.map((r, i) => (
                      <Badge key={i} variant="outline">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="flex justify-center py-4">
        {loading && <p className="text-sm text-muted-foreground">Loading more...</p>}
        {!hasMore && jobs.length > 0 && (
          <p className="text-sm text-muted-foreground">All positions loaded</p>
        )}
      </div>
    </div>
  )
}
