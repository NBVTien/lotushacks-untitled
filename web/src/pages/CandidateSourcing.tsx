import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { jobsApi, discoveryApi } from '@/lib/api'
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
  GitHub: 'bg-gray-800 text-white',
  LinkedIn: 'bg-indigo-100 text-indigo-800',
  StackOverflow: 'bg-orange-100 text-orange-800',
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

  const eventSourceRef = useRef<EventSource | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const loadJob = useCallback(async () => {
    if (!jobId) return
    try {
      const data = await jobsApi.get(jobId)
      setJob(data)
    } catch { /* ignore */ }
  }, [jobId])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  const connectStream = (streamId: string) => {
    const url = discoveryApi.streamUrl('source-candidates', streamId)
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.log) {
          setLogs(prev => [...prev, data.log])
        }
        if (data.candidates) {
          setCandidates(data.candidates)
        }
        if (data.done) {
          es.close()
          eventSourceRef.current = null
          setSourcing(false)
          if (data.candidates) setCandidates(data.candidates)
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setSourcing(false)
    }
  }

  const handleSourceFromJob = async () => {
    if (!jobId) return
    setSourcing(true)
    setError(null)
    setLogs([])
    setCandidates([])

    try {
      const result = await discoveryApi.sourceFromJob(jobId)
      if (result.streamId) {
        connectStream(result.streamId)
      } else {
        if (result.candidates) setCandidates(result.candidates)
        setSourcing(false)
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to source candidates')
      setSourcing(false)
    }
  }

  const handleManualSource = async () => {
    const skillList = manualSkills.split(',').map(s => s.trim()).filter(Boolean)
    if (skillList.length === 0 && !manualTitle.trim()) return

    setSourcing(true)
    setError(null)
    setLogs([])
    setCandidates([])

    try {
      const result = await discoveryApi.sourceCandidates({
        jobTitle: manualTitle.trim(),
        skills: skillList,
        location: manualLocation.trim() || null,
        experience: manualExperience.trim() || null,
      })
      if (result.streamId) {
        connectStream(result.streamId)
      } else {
        if (result.candidates) setCandidates(result.candidates)
        setSourcing(false)
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to source candidates')
      setSourcing(false)
    }
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
