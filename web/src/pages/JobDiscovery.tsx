import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Search, Radio } from 'lucide-react'
import { PageTransition } from '@/components/ui/motion'

interface DiscoveredJob {
  title: string
  company: string
  location: string
  url: string
  source: string
  salary?: string
  requirements: string[]
  matchReason?: string
  matchScore?: number
}

const sourceBadgeColors: Record<string, string> = {
  Upwork: 'bg-green-100 text-green-800',
  Wellfound: 'bg-amber-100 text-amber-800',
}

export function JobDiscoveryPage() {
  const [tab, setTab] = useState('skills')
  const [skills, setSkills] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<DiscoveredJob[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const streamSearch = async (url: string, body: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    setLogs([])
    setJobs([])
    setSearched(true)

    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      })

      if (!response.body) throw new Error('No response body')
      await processStream(response.body)
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error)?.message || 'Failed to search jobs')
      }
      setLoading(false)
    }
  }

  const streamUpload = async (url: string, formData: FormData) => {
    setLoading(true)
    setError(null)
    setLogs([])
    setJobs([])
    setSearched(true)

    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal: abort.signal,
      })

      if (!response.body) throw new Error('No response body')
      await processStream(response.body)
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error)?.message || 'Failed to search jobs')
      }
      setLoading(false)
    }
  }

  const processStream = async (body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue

        try {
          const event = JSON.parse(jsonStr)
          if (event.type === 'progress' && event.message) {
            setLogs((prev) => [...prev, event.message])
          }
          if (event.log) {
            setLogs((prev) => [...prev, event.log])
          }
          if (event.type === 'complete' && event.result) {
            const resultJobs: DiscoveredJob[] = event.result.jobs || event.result || []
            setJobs(sortJobsByScore(resultJobs))
          }
          if (event.jobs) {
            setJobs(sortJobsByScore(event.jobs))
          }
          if (event.type === 'error') {
            setError(event.message || 'Search failed')
          }
          if (event.done) {
            setLoading(false)
          }
        } catch {
          /* skip malformed */
        }
      }
    }
    setLoading(false)
  }

  const sortJobsByScore = (jobList: DiscoveredJob[]): DiscoveredJob[] => {
    return [...jobList].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
  }

  const handleSkillsSearch = () => {
    const skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (skillList.length === 0) return

    streamSearch('http://localhost:4005/discovery/jobs', {
      skills: skillList,
      experience: [],
      location: location.trim() || null,
      title: title.trim() || null,
    })
  }

  const handleCvUpload = () => {
    if (!cvFile) return

    const formData = new FormData()
    formData.append('cv', cvFile)

    streamUpload('http://localhost:4005/discovery/jobs-from-upload', formData)
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-8">
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="skills">Search by Skills</TabsTrigger>
            <TabsTrigger value="upload">Upload CV</TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="space-y-4">
            <Card>
              <CardContent className="py-6 space-y-4">
                <div>
                  <Label>Skills (comma-separated)</Label>
                  <Input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="React, TypeScript, Node.js, PostgreSQL"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Job Title (optional)</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Senior Frontend Developer"
                    />
                  </div>
                  <div>
                    <Label>Location (optional)</Label>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ho Chi Minh City"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSkillsSearch}
                  disabled={loading || skills.trim().length === 0}
                  className="w-full gap-2"
                >
                  <Search className="h-4 w-4" />
                  {loading ? 'Searching...' : 'Search Jobs'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardContent className="py-6 space-y-4">
                <div>
                  <Label>Upload your CV (PDF)</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                </div>
                {cvFile && <p className="text-sm text-muted-foreground">Selected: {cvFile.name}</p>}
                <Button onClick={handleCvUpload} disabled={loading || !cvFile} className="w-full">
                  {loading ? 'Analyzing CV & Searching...' : 'Find Jobs from CV'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-4">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Log viewer */}
        {(loading || logs.length > 0) && (
          <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/40">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-muted-foreground font-mono">Search Progress</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-1.5 w-1.5 rounded-full ${loading ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                />
                <span className="text-sm text-muted-foreground">
                  {loading ? 'Streaming...' : 'Complete'}
                </span>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto px-4 pb-4 font-mono text-xs">
              {logs.map((log, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed">
                  <span className="inline-block w-6 text-right text-muted-foreground/40 mr-3 select-none">
                    {i + 1}
                  </span>
                  {log}
                </p>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Loading spinner (only if no logs yet) */}
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
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              Found {jobs.length} matching jobs
            </h2>
            {jobs.map((job, i) => (
              <Card
                key={i}
                className="shadow-sm border-border/50 transition-shadow duration-200 hover:shadow-md"
              >
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lg font-semibold hover:underline hover:text-primary transition-colors"
                      >
                        {job.title}
                      </a>
                      <p className="text-sm text-muted-foreground">
                        {job.company}
                        {job.location && ` \u00B7 ${job.location}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.matchScore != null && (
                        <span className="bg-primary/8 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                          {Math.round(job.matchScore)}% match
                        </span>
                      )}
                      <Badge
                        className={sourceBadgeColors[job.source] || 'bg-gray-100 text-gray-800'}
                      >
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
                    <div className="rounded border bg-muted/50 p-2">
                      <p className="text-sm">{job.matchReason}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <a href={job.url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        View Job
                      </Button>
                    </a>
                    {job.company && (
                      <Link to={`/careers/company/${encodeURIComponent(job.company)}`}>
                        <Button size="sm" variant="ghost">
                          Research Company
                        </Button>
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
            <p className="text-muted-foreground">
              No matching jobs found. Try adjusting your skills or location.
            </p>
          </div>
        )}

        {!searched && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Enter your skills or upload your CV to discover matching jobs across multiple
              platforms
            </p>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
