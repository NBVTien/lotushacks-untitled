import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { discoveryApi } from '@/lib/api'

interface DiscoveredJob {
  title: string
  company: string
  location: string
  url: string
  source: string
  salary?: string
  requirements: string[]
  matchReason?: string
}

const sourceBadgeColors: Record<string, string> = {
  ITviec: 'bg-green-100 text-green-800',
  TopDev: 'bg-blue-100 text-blue-800',
  LinkedIn: 'bg-indigo-100 text-indigo-800',
}

export function JobDiscoveryPage() {
  const [skills, setSkills] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<DiscoveredJob[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const handleSearch = async () => {
    const skillList = skills.split(',').map(s => s.trim()).filter(Boolean)
    if (skillList.length === 0) return

    setLoading(true)
    setError(null)
    setLogs([])
    setJobs([])
    setSearched(true)

    try {
      const result = await discoveryApi.discoverJobs({
        skills: skillList,
        experience: [],
        location: location.trim() || null,
        title: title.trim() || null,
      })

      // If streaming ID returned, connect to SSE
      if (result.streamId) {
        const url = discoveryApi.streamUrl('jobs', result.streamId)
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.log) {
              setLogs(prev => [...prev, data.log])
            }
            if (data.jobs) {
              setJobs(data.jobs)
            }
            if (data.done) {
              es.close()
              eventSourceRef.current = null
              setLoading(false)
              if (data.jobs) setJobs(data.jobs)
            }
          } catch { /* ignore parse errors */ }
        }

        es.onerror = () => {
          es.close()
          eventSourceRef.current = null
          setLoading(false)
        }
      } else {
        // Direct response (no streaming)
        if (result.jobs) setJobs(result.jobs)
        setLoading(false)
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to search jobs')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/careers" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Careers
        </Link>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold">Discover Jobs</h1>
        <p className="mt-2 text-muted-foreground">
          Let AI find matching jobs across multiple platforms
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardContent className="py-6 space-y-4">
          <div>
            <Label>Skills (comma-separated)</Label>
            <Input
              value={skills}
              onChange={e => setSkills(e.target.value)}
              placeholder="React, TypeScript, Node.js, PostgreSQL"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Job Title (optional)</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Senior Frontend Developer"
              />
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Ho Chi Minh City"
              />
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || skills.trim().length === 0}
            className="w-full"
          >
            {loading ? 'Searching...' : 'Search Jobs'}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Streaming Logs */}
      {loading && logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Search Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded border bg-muted/50 p-3 max-h-48 overflow-y-auto">
              {logs.map((log, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading spinner */}
      {loading && logs.length === 0 && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Searching job boards...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {jobs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Found {jobs.length} matching jobs</h2>
          {jobs.map((job, i) => (
            <Card key={i}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-lg font-semibold hover:underline"
                    >
                      {job.title}
                    </a>
                    <p className="text-sm text-muted-foreground">
                      {job.company}
                      {job.location && ` \u00B7 ${job.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={sourceBadgeColors[job.source] || 'bg-gray-100 text-gray-800'}>
                      {job.source}
                    </Badge>
                    {job.salary && (
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        {job.salary}
                      </Badge>
                    )}
                  </div>
                </div>

                {job.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {job.requirements.map((r, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}

                {job.matchReason && (
                  <div className="rounded border border-blue-200 bg-blue-50 p-2">
                    <p className="text-sm text-blue-900">{job.matchReason}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <a href={job.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">View Job</Button>
                  </a>
                  {job.company && (
                    <Link to={`/careers/company/${encodeURIComponent(job.company)}`}>
                      <Button size="sm" variant="ghost">Research Company</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && jobs.length === 0 && !error && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No matching jobs found. Try adjusting your skills or location.</p>
        </div>
      )}

      {!searched && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Enter your skills to discover matching jobs across multiple platforms
          </p>
        </div>
      )}
    </div>
  )
}
