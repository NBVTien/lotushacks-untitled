import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { jobsApi, discoveryApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'
import { PageTransition } from '@/components/ui/motion'
import { ErrorState } from '@/components/ErrorState'

interface SourcedCandidate {
  name: string
  title: string
  profileUrl: string
  source: string
  skills: string[]
  location?: string
  experience?: string
  matchReason?: string
  matchScore?: number
  detailedProfile?: string
}

interface SourcingHistoryEntry {
  id: string
  date: string
  query: string
  candidateCount: number
  candidates: SourcedCandidate[]
}

const sourceColors: Record<string, string> = {
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
  const [history, setHistory] = useState<SourcingHistoryEntry[]>([])
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({})

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
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const loadJob = useCallback(async () => {
    if (!jobId) return
    try {
      const data = await jobsApi.get(jobId)
      setJob(data)
    } catch {
      /* ignore */
    }
  }, [jobId])

  const loadHistory = useCallback(async () => {
    if (!jobId) return
    try {
      const data = await discoveryApi.sourcingHistory(jobId)
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      /* ignore - endpoint may not exist yet */
    }
  }, [jobId])

  useEffect(() => {
    loadJob()
  }, [loadJob])
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const toggleExpanded = (index: number) => {
    setExpandedCards((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const streamSourcing = async (url: string, body: Record<string, unknown>) => {
    setSourcing(true)
    setError(null)
    setLogs([])
    setCandidates([])
    setExpandedCards({})

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
              setLogs((prev) => [...prev, event.message])
            }
            if (event.type === 'complete' && event.result) {
              setCandidates(event.result.candidates || [])
            }
            if (event.type === 'error') {
              setError(event.message || 'Sourcing failed')
            }
            if (event.done) {
              setSourcing(false)
              loadHistory()
            }
          } catch {
            /* skip malformed */
          }
        }
      }
      setSourcing(false)
      loadHistory()
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
    const skillList = manualSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (skillList.length === 0 && !manualTitle.trim()) return
    streamSourcing('http://localhost:4005/discovery/source-candidates', {
      jobTitle: manualTitle.trim(),
      skills: skillList,
      location: manualLocation.trim() || null,
      experience: manualExperience.trim() || null,
    })
  }

  const handleLoadFromHistory = (entry: SourcingHistoryEntry) => {
    setCandidates(entry.candidates || [])
    setExpandedCards({})
    setError(null)
    setLogs([])
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <Link
            to={`/jobs/${jobId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
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
                        <Badge key={i} variant="secondary">
                          {r}
                        </Badge>
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
                    onChange={(e) => setManualSkills(e.target.value)}
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Job Title</Label>
                    <Input
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Senior Developer"
                    />
                  </div>
                  <div>
                    <Label>Location (optional)</Label>
                    <Input
                      value={manualLocation}
                      onChange={(e) => setManualLocation(e.target.value)}
                      placeholder="Ho Chi Minh City"
                    />
                  </div>
                  <div>
                    <Label>Experience (optional)</Label>
                    <Input
                      value={manualExperience}
                      onChange={(e) => setManualExperience(e.target.value)}
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
        {error && <ErrorState message={error} />}

        {/* Log viewer */}
        {(sourcing || logs.length > 0) && (
          <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/40">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-muted-foreground font-mono">Sourcing Progress</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-1.5 w-1.5 rounded-full ${sourcing ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                />
                <span className="text-sm text-muted-foreground">
                  {sourcing ? 'Streaming...' : 'Complete'}
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
              <Card
                key={i}
                className="shadow-sm border-border/50 transition-shadow duration-200 hover:shadow-md"
              >
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <a
                        href={c.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold hover:underline hover:text-primary transition-colors"
                      >
                        {c.name}
                      </a>
                      {c.title && <p className="text-sm text-muted-foreground">{c.title}</p>}
                      {c.location && <p className="text-xs text-muted-foreground">{c.location}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.matchScore != null && (
                        <span className="bg-primary/8 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                          {c.matchScore}% match
                        </span>
                      )}
                      <Badge className={sourceColors[c.source] || 'bg-gray-100 text-gray-800'}>
                        {c.source}
                      </Badge>
                      {c.experience && <Badge variant="outline">{c.experience}</Badge>}
                    </div>
                  </div>

                  {c.matchReason && (
                    <div className="rounded border bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Analysis</p>
                      <p className="text-sm">{c.matchReason}</p>
                    </div>
                  )}

                  {c.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.skills.map((s, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <a href={c.profileUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        View Profile
                      </Button>
                    </a>
                  </div>

                  {c.detailedProfile && (
                    <Collapsible
                      open={expandedCards[i] || false}
                      onOpenChange={() => toggleExpanded(i)}
                    >
                      <CollapsibleTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground px-3 py-1.5 cursor-pointer">
                        {expandedCards[i] ? 'Hide details' : 'Show detailed profile'}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded border bg-muted/50 p-3">
                          <p className="text-sm whitespace-pre-wrap">{c.detailedProfile}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
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

        {/* Sourcing History */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Past Sourcing Runs</h2>
            {history.map((entry) => (
              <Card
                key={entry.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleLoadFromHistory(entry)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entry.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {entry.candidateCount} candidate{entry.candidateCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
