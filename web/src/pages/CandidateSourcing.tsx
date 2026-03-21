import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { jobsApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

interface SourcedCandidate {
  name: string
  title: string
  profileUrl: string
  source: string
  skills: string[]
  location?: string
  experience?: string
  matchReason?: string
}

const sourceColors: Record<string, string> = {
  LinkedIn: 'bg-blue-100 text-blue-800',
  Upwork: 'bg-green-100 text-green-800',
  Toptal: 'bg-indigo-100 text-indigo-800',
}

export function CandidateSourcingPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [sourcing, setSourcing] = useState(false)
  const [candidates, setCandidates] = useState<SourcedCandidate[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('auto')

  // Manual form
  const [manualSkills, setManualSkills] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [manualLocation, setManualLocation] = useState('')
  const [manualExperience, setManualExperience] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const loadJob = useCallback(async () => {
    if (!jobId) return
    try {
      const data = await jobsApi.get(jobId)
      setJob(data)
    } catch { /* ignore */ }
  }, [jobId])

  useEffect(() => { loadJob() }, [loadJob])

  /** Stream SSE from a POST endpoint */
  const streamSourcing = async (url: string, body: Record<string, unknown>) => {
    setSourcing(true)
    setError(null)
    setLogs([])
    setCandidates([])

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

      const reader = response.body.getReader()
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
              setLogs(prev => [...prev, event.message])
            }
            if (event.type === 'complete' && event.result) {
              setCandidates(event.result.candidates || [])
            }
            if (event.type === 'error') {
              setError(event.message || 'Sourcing failed')
            }
            if (event.done) {
              setSourcing(false)
            }
          } catch { /* skip malformed */ }
        }
      }
      setSourcing(false)
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error)?.message || 'Failed to source candidates')
      }
      setSourcing(false)
    }
  }

  const handleSourceFromJob = () => {
    if (!jobId) return
    streamSourcing('http://localhost:4005/discovery/source-from-job', { jobId })
  }

  const handleManualSource = () => {
    const skillList = manualSkills.split(',').map(s => s.trim()).filter(Boolean)
    if (skillList.length === 0 && !manualTitle.trim()) return
    streamSourcing('http://localhost:4005/discovery/source-candidates', {
      jobTitle: manualTitle.trim(),
      skills: skillList,
      location: manualLocation.trim() || null,
      experience: manualExperience.trim() || null,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/jobs/${jobId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Job
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Source Candidates</h1>
        {job && <p className="mt-1 text-muted-foreground">For: {job.title}</p>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="auto">From Job Requirements</TabsTrigger>
          <TabsTrigger value="manual">Manual Search</TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="space-y-4">
          {job && (
            <Card>
              <CardContent className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Source candidates matching the requirements of this job automatically.
                </p>
                {job.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {job.requirements.map((r, i) => (
                      <Badge key={i} variant="secondary">{r}</Badge>
                    ))}
                  </div>
                )}
                <Button onClick={handleSourceFromJob} disabled={sourcing}>
                  {sourcing ? 'Sourcing...' : 'Source Candidates'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardContent className="py-4 space-y-4">
              <div>
                <Label>Skills (comma-separated)</Label>
                <Input
                  value={manualSkills}
                  onChange={e => setManualSkills(e.target.value)}
                  placeholder="React, TypeScript, Node.js"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Job Title</Label>
                  <Input
                    value={manualTitle}
                    onChange={e => setManualTitle(e.target.value)}
                    placeholder="Senior Developer"
                  />
                </div>
                <div>
                  <Label>Location (optional)</Label>
                  <Input
                    value={manualLocation}
                    onChange={e => setManualLocation(e.target.value)}
                    placeholder="Ho Chi Minh City"
                  />
                </div>
                <div>
                  <Label>Experience (optional)</Label>
                  <Input
                    value={manualExperience}
                    onChange={e => setManualExperience(e.target.value)}
                    placeholder="3+ years"
                  />
                </div>
              </div>
              <Button onClick={handleManualSource} disabled={sourcing}>
                {sourcing ? 'Sourcing...' : 'Search Candidates'}
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

      {/* Streaming Logs */}
      {sourcing && logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sourcing Progress</CardTitle>
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

      {sourcing && logs.length === 0 && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Sourcing candidates...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {candidates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Found {candidates.length} candidates</h2>
          {candidates.map((c, i) => (
            <Card key={i}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <a
                      href={c.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold hover:underline"
                    >
                      {c.name}
                    </a>
                    {c.title && (
                      <p className="text-sm text-muted-foreground">{c.title}</p>
                    )}
                    {c.location && (
                      <p className="text-xs text-muted-foreground">{c.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={sourceColors[c.source] || 'bg-gray-100 text-gray-800'}>
                      {c.source}
                    </Badge>
                    {c.experience && (
                      <Badge variant="outline">{c.experience}</Badge>
                    )}
                  </div>
                </div>

                {c.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.skills.map((s, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}

                {c.matchReason && (
                  <div className="rounded border border-blue-200 bg-blue-50 p-2">
                    <p className="text-sm text-blue-900">{c.matchReason}</p>
                  </div>
                )}

                <a href={c.profileUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">View Profile</Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!sourcing && candidates.length === 0 && !error && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Click "Source Candidates" to find matching candidates from multiple platforms.
          </p>
        </div>
      )}
    </div>
  )
}
