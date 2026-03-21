import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { candidatesApi } from '@/lib/api'
import type { Candidate, EnrichmentProgress, CompanyIntel } from '@lotushack/shared'

const recommendationColors: Record<string, string> = {
  strong_match: 'bg-green-100 text-green-800',
  good_match: 'bg-blue-100 text-blue-800',
  partial_match: 'bg-yellow-100 text-yellow-800',
  weak_match: 'bg-red-100 text-red-800',
}

export function CandidateDetailPage() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [forcePolling, setForcePolling] = useState(false)

  const load = useCallback(async () => {
    if (!jobId || !candidateId || notFound) return
    try {
      const data = await candidatesApi.get(jobId, candidateId)
      setCandidate(data)
      // Stop forced polling once processing finishes
      if (forcePolling && (data.status === 'completed' || data.status === 'error')) {
        setForcePolling(false)
      }
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setNotFound(true)
      }
    }
  }, [jobId, candidateId, notFound, forcePolling])

  const isDone = !forcePolling && (candidate?.status === 'completed' || candidate?.status === 'error')

  useEffect(() => {
    load()
    if (isDone) return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load, isDone])

  const handleReEnrich = async () => {
    await candidatesApi.reEnrich(jobId!, candidateId!)
    setForcePolling(true)
    load()
  }

  const handleRetry = async () => {
    await candidatesApi.retry(jobId!, candidateId!)
    setForcePolling(true)
    load()
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link to={`/jobs/${jobId}`} className="text-sm text-muted-foreground hover:text-foreground">&larr; Back</Link>
        <p className="text-muted-foreground">Candidate not found.</p>
      </div>
    )
  }

  if (!candidate) return <p>Loading...</p>

  const { matchResult, enrichment, links } = candidate

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/jobs/${jobId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Candidates
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{candidate.name}</h1>
          {(candidate.email || candidate.phone) && (
            <p className="text-muted-foreground">
              {[candidate.email, candidate.phone].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {links.github && (
              <Badge variant="outline">
                <a href={links.github} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </Badge>
            )}
            {links.linkedin && (
              <Badge variant="outline">
                <a href={links.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              </Badge>
            )}
          </div>
        </div>
        {matchResult && (
          <div className="text-right">
            <p className="text-4xl font-bold">{matchResult.overallScore}</p>
            <Badge className={recommendationColors[matchResult.recommendation] || ''}>
              {matchResult.recommendation.replace('_', ' ')}
            </Badge>
          </div>
        )}
      </div>

      <Separator />

      {candidate.status === 'error' && (
        <Card className="border-destructive">
          <CardContent className="py-4 space-y-2">
            <p className="text-destructive font-medium">Processing failed</p>
            {candidate.errorMessage && (
              <p className="text-sm text-muted-foreground">{candidate.errorMessage}</p>
            )}
            <div className="flex items-center gap-3">
              {candidate.retryCount < 3 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                >
                  Retry ({candidate.retryCount}/3)
                </Button>
              ) : (
                <p className="text-sm text-destructive">Maximum retries reached (3/3)</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {candidate.status !== 'completed' && candidate.status !== 'error' && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <p className="text-muted-foreground">
              Status: <strong>{candidate.status}</strong> — processing...
            </p>
            {candidate.progressLogs && candidate.progressLogs.length > 0 && (
              <div className="rounded border bg-muted/50 p-3 max-h-40 overflow-y-auto">
                {candidate.progressLogs.map((log, i) => (
                  <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="score">
        <TabsList>
          <TabsTrigger value="score">Match Score</TabsTrigger>
          <TabsTrigger value="parsed">Parsed CV</TabsTrigger>
          <TabsTrigger value="online">Online Profile</TabsTrigger>
          <TabsTrigger value="cv">Raw CV</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="space-y-4">
          {matchResult ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Based on: CV</Badge>
                {candidate.parsedCV && <Badge variant="secondary">AI-parsed skills & experience</Badge>}
                {enrichment?.github && <Badge variant="secondary">GitHub profile</Badge>}
                {enrichment?.linkedin && <Badge variant="secondary">LinkedIn profile</Badge>}
                {!enrichment?.github && !enrichment?.linkedin && links.github && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-300">Enrichment missing — score may improve with re-enrich</Badge>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Explanation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{matchResult.explanation}</p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-700">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-sm">
                      {matchResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-700">Gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-sm">
                      {matchResult.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Score not yet available.</p>
          )}
        </TabsContent>

        <TabsContent value="parsed" className="space-y-4">
          {candidate.parsedCV ? (
            <>
              {candidate.parsedCV.summary && (
                <Card>
                  <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm">{candidate.parsedCV.summary}</p>
                  </CardContent>
                </Card>
              )}

              {candidate.parsedCV.skills.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {candidate.parsedCV.skills.map((s, i) => (
                        <Badge key={i} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {candidate.parsedCV.experience.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Experience</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {candidate.parsedCV.experience.map((exp, i) => (
                      <div key={i} className="border-l-2 border-muted pl-3">
                        <p className="font-medium">{exp.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {exp.company} &middot; {exp.duration}
                        </p>
                        {exp.description && (
                          <p className="mt-1 text-sm">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {candidate.parsedCV.education.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Education</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {candidate.parsedCV.education.map((edu, i) => (
                      <div key={i}>
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-muted-foreground">
                          {edu.school} &middot; {edu.year}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">CV not yet parsed.</p>
          )}
        </TabsContent>

        <TabsContent value="online" className="space-y-4">
          {/* GitHub profile card with inline re-fetch */}
          {(links.github || enrichment?.github) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {enrichment?.github ? (
                      <a href={links.github || '#'} target="_blank" rel="noreferrer" className="hover:underline">
                        GitHub: @{enrichment.github.username}
                      </a>
                    ) : 'GitHub'}
                  </CardTitle>
                  {(candidate.status === 'completed' || candidate.status === 'error') && links.github && (
                    <Button variant="outline" size="sm" onClick={handleReEnrich}>
                      {enrichment?.github ? 'Re-fetch' : 'Fetch'}
                    </Button>
                  )}
                  {['enriching', 'scoring'].includes(candidate.status) && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-700">
                      {candidate.status === 'scoring' ? 'Scoring...' : 'Fetching...'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {enrichment?.github ? (
                <CardContent className="space-y-4">
                  {enrichment.github.bio && <p className="text-sm">{enrichment.github.bio}</p>}
                  {enrichment.github.topLanguages.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {enrichment.github.topLanguages.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Total stars: {enrichment.github.totalStars}
                    {enrichment.github.totalContributions != null && ` | Contributions: ${enrichment.github.totalContributions}`}
                    {(() => { try { const d = JSON.parse(enrichment.github.raw); return d.publicRepos ? ` | ${d.publicRepos} public repos` : ''; } catch { return ''; } })()}
                    {(() => { try { const d = JSON.parse(enrichment.github.raw); return d.followers ? ` | ${d.followers} followers` : ''; } catch { return ''; } })()}
                  </p>
                  <GitHubAnalysis raw={enrichment.github.raw} username={enrichment.github.username} />
                  {enrichment.github.repositories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Repositories ({enrichment.github.repositories.length})</p>
                      {enrichment.github.repositories.slice(0, 5).map((r) => (
                        <div key={r.name} className="rounded bg-muted p-2 text-sm">
                          <a href={`https://github.com/${enrichment!.github!.username}/${r.name}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{r.name}</a>
                          {r.language && <Badge variant="outline" className="ml-2">{r.language}</Badge>}
                          <span className="ml-2 text-muted-foreground">{r.stars} stars</span>
                          {r.description && <p className="mt-1 text-muted-foreground">{r.description}</p>}
                        </div>
                      ))}
                      {enrichment.github.repositories.length > 5 && (
                        <p className="text-xs text-muted-foreground">+ {enrichment.github.repositories.length - 5} more repositories</p>
                      )}
                    </div>
                  )}
                  {/* Progress logs during fetch */}
                  {['enriching'].includes(candidate.status) && candidate.progressLogs?.length > 0 && (
                    <div className="rounded border bg-muted/50 p-2 max-h-32 overflow-y-auto">
                      {candidate.progressLogs.map((log, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              ) : (
                <CardContent>
                  <p className="text-sm text-muted-foreground">Click Fetch to load GitHub profile data.</p>
                </CardContent>
              )}
            </Card>
          )}

          {/* Extended Analysis — per-type cards with async execution & integrated results */}
          <ExtendedAnalysis candidate={candidate} jobId={jobId!} candidateId={candidateId!} onAction={handleReEnrich} load={load} setForcePolling={setForcePolling} />
        </TabsContent>

        <TabsContent value="cv">
          <Card>
            <CardContent className="py-4">
              <pre className="whitespace-pre-wrap text-sm">{candidate.cvText || 'No text extracted yet.'}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <PdfViewer jobId={jobId!} candidateId={candidateId!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const statusColors: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

interface EnrichmentCategory {
  label: string
  types: { key: string; label: string; desc: string; available: boolean }[]
}

function ExtendedAnalysis({
  candidate, jobId, candidateId, load,
}: {
  candidate: Candidate; jobId: string; candidateId: string;
  onAction: () => void; load: () => void; setForcePolling: (v: boolean) => void;
}) {
  const ext = candidate.extendedEnrichment
  const hasPortfolioUrls = (candidate.links.portfolio?.length || 0) > 0
  const hasLinkedIn = !!candidate.links.linkedin

  // SSE streaming state
  const [liveProgress, setLiveProgress] = useState<EnrichmentProgress>(candidate.enrichmentProgress || {})
  const [liveCandidate, setLiveCandidate] = useState<Partial<Candidate>>({})
  const eventSourceRef = useRef<EventSource | null>(null)
  const [streaming, setStreaming] = useState(false)

  // Merge live data with candidate data
  const progress = { ...(candidate.enrichmentProgress || {}), ...liveProgress }
  const hasRunning = Object.values(progress).some((p) => p.status === 'running' || p.status === 'queued')

  // Start SSE when there are running jobs
  useEffect(() => {
    if (!hasRunning) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setStreaming(false)
        // Final refresh to get completed data
        load()
      }
      return
    }
    if (eventSourceRef.current) return // already streaming

    const url = candidatesApi.enrichmentStreamUrl(jobId, candidateId)
    const es = new EventSource(url)
    eventSourceRef.current = es
    setStreaming(true)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.done) {
          es.close()
          eventSourceRef.current = null
          setStreaming(false)
          load()
          return
        }
        if (data.enrichmentProgress) setLiveProgress(data.enrichmentProgress)
        if (data.matchResult || data.enrichment || data.extendedEnrichment) {
          setLiveCandidate(data)
        }
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setStreaming(false)
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [hasRunning, jobId, candidateId, load])

  // Use live matchResult if available
  const matchResult = liveCandidate.matchResult || candidate.matchResult
  const enrichment = liveCandidate.enrichment || candidate.enrichment

  // Determine URL availability from classified URLs
  const classified = candidate.links.classified || []
  const portfolioUrls = candidate.links.portfolio || []

  // Helper: check if URL is a source code repo (not a live deployed app)
  const isSourceCodeUrl = (u: string) => /github\.com|gitlab\.com|bitbucket\.org|youtu\.be|youtube\.com/i.test(u)

  // Build URL lists per enrichment type
  // Build company experience entries for companyIntel
  const companyEntries = (candidate.parsedCV?.experience || []).map((exp) => ({
    url: '#',
    label: `${exp.company} (${exp.title})`,
  }))

  const urlsForType: Record<string, { url: string; label: string }[]> = {
    linkedin: candidate.links.linkedin ? [{ url: candidate.links.linkedin, label: candidate.links.linkedin.replace(/https?:\/\/(www\.)?/, '') }] : [],
    companyIntel: companyEntries,
    portfolio: classified.filter((c) => c.kind === 'portfolio' || c.kind === 'company').map((c) => ({ url: c.url, label: c.label })),
    blog: [
      ...classified.filter((c) => c.kind === 'blog').map((c) => ({ url: c.url, label: c.label })),
      ...portfolioUrls.filter((u) => /dev\.to|medium\.com|hashnode|blog/i.test(u) && !classified.some((c) => c.url === u)).map((u) => ({ url: u, label: new URL(u).hostname })),
    ],
    stackoverflow: portfolioUrls.filter((u) => /stackoverflow\.com/i.test(u)).map((u) => ({ url: u, label: 'Stack Overflow' })),
    liveProjects: [
      // Only include non-source-code URLs classified as projects
      ...classified.filter((c) => c.kind === 'project' && !isSourceCodeUrl(c.url)).map((c) => ({ url: c.url, label: c.label })),
      // Fallback: non-classified portfolio URLs that are NOT source code repos
      ...portfolioUrls.filter((u) => !isSourceCodeUrl(u) && !classified.some((c) => c.url === u) && !/stackoverflow|dev\.to|medium\.com|hashnode|blog/i.test(u)).map((u) => {
        try { return { url: u, label: new URL(u).hostname } } catch { return { url: u, label: u } }
      }),
    ],
  }
  // If no classified data, fall back — but still exclude source code URLs from live projects
  if (classified.length === 0 && portfolioUrls.length > 0) {
    const nonCodeUrls = portfolioUrls.filter((u) => !isSourceCodeUrl(u)).map((u) => {
      try { return { url: u, label: new URL(u).hostname } } catch { return { url: u, label: u } }
    })
    urlsForType.portfolio = nonCodeUrls
    urlsForType.liveProjects = nonCodeUrls
  }

  const hasProjectUrls = urlsForType.liveProjects.length > 0
  const hasBlogUrls = urlsForType.blog.length > 0
  const hasSOUrls = urlsForType.stackoverflow.length > 0

  // Categories
  const categories: EnrichmentCategory[] = [
    {
      label: 'Social Profiles',
      types: [
        { key: 'linkedin', label: 'LinkedIn', desc: 'Crawl LinkedIn profile via TinyFish', available: hasLinkedIn },
      ],
    },
    {
      label: 'Web Presence',
      types: [
        { key: 'portfolio', label: 'Portfolio / Websites', desc: 'Analyze websites found in CV', available: urlsForType.portfolio.length > 0 || hasPortfolioUrls },
        { key: 'blog', label: 'Blog / Articles', desc: 'Analyze dev.to, Medium, Hashnode posts', available: hasBlogUrls || hasPortfolioUrls },
        { key: 'stackoverflow', label: 'Stack Overflow', desc: 'Check SO reputation, badges, top tags', available: hasSOUrls || hasPortfolioUrls },
      ],
    },
    {
      label: 'Projects',
      types: [
        { key: 'liveProjects', label: 'Live Projects', desc: 'Visit deployed apps & products from CV', available: hasProjectUrls },
      ],
    },
    {
      label: 'Company Verification',
      types: [
        { key: 'companyIntel', label: 'Company Intel', desc: 'Verify companies from candidate experience', available: (candidate.parsedCV?.experience?.length || 0) > 0 },
      ],
    },
  ]

  const runType = async (type: string) => {
    await candidatesApi.extendedEnrich(jobId, candidateId, [type])
    setLiveProgress((prev) => ({ ...prev, [type]: { status: 'queued', logs: [] } }))
  }

  const runCategory = async (cat: EnrichmentCategory) => {
    const available = cat.types.filter((t) => t.available).map((t) => t.key)
    if (available.length === 0) return
    await candidatesApi.extendedEnrich(jobId, candidateId, available)
    setLiveProgress((prev) => {
      const next = { ...prev }
      for (const key of available) next[key] = { status: 'queued', logs: [] }
      return next
    })
  }

  // Helper to render inline result for a type
  const renderResult = (key: string) => {
    const li = enrichment?.linkedin
    if (key === 'linkedin' && li && (li.headline || li.summary || li.experience.length > 0 || li.skills.length > 0)) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          {li.headline && <p className="font-medium text-sm">{li.headline}</p>}
          {li.summary && <p className="text-sm text-muted-foreground">{li.summary}</p>}
          {li.skills.length > 0 && <div className="flex flex-wrap gap-1">{li.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>}
          {li.experience.length > 0 && <ul className="list-disc pl-4 text-sm text-muted-foreground">{li.experience.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )
    }
    if (key === 'portfolio' && ext?.portfolio) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={ext.portfolio.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">{ext.portfolio.url}</a>
            <Badge variant={ext.portfolio.isOnline ? 'secondary' : 'destructive'} className="text-xs">{ext.portfolio.isOnline ? 'Online' : 'Offline'}</Badge>
            <Badge variant="outline" className="text-xs">Design: {ext.portfolio.designQuality}</Badge>
            {ext.portfolio.hasResponsive && <Badge variant="outline" className="text-xs">Responsive</Badge>}
          </div>
          {ext.portfolio.techStack.length > 0 && <div className="flex gap-1 flex-wrap">{ext.portfolio.techStack.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>}
          <p className="text-sm text-muted-foreground">{ext.portfolio.summary}</p>
        </div>
      )
    }
    if (key === 'liveProjects' && ext?.liveProjects && ext.liveProjects.length > 0) {
      return (
        <div className="mt-3 space-y-3 border-t pt-3">
          {ext.liveProjects.map((p, i) => (
            <div key={i} className="border-l-2 border-muted pl-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={p.url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline">{p.name}</a>
                <Badge variant={p.isOnline ? 'secondary' : 'destructive'} className="text-xs">{p.isOnline ? 'Online' : 'Offline'}</Badge>
                <Badge variant="outline" className="text-xs">UI: {p.uiQuality}</Badge>
              </div>
              {p.techDetected.length > 0 && <div className="flex gap-1 flex-wrap">{p.techDetected.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>}
              {p.features.length > 0 && <p className="text-xs text-muted-foreground">Features: {p.features.join(', ')}</p>}
              <p className="text-sm text-muted-foreground">{p.summary}</p>
            </div>
          ))}
        </div>
      )
    }
    if (key === 'blog' && ext?.blog) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">{ext.blog.platform} | {ext.blog.totalPosts} posts | Writing: {ext.blog.writingQuality}</p>
          {ext.blog.topicFocus.length > 0 && <div className="flex gap-1 flex-wrap">{ext.blog.topicFocus.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>}
          {ext.blog.recentPosts.length > 0 && ext.blog.recentPosts.map((p, i) => <p key={i} className="text-xs text-muted-foreground">{p.title} ({p.date})</p>)}
          <p className="text-sm text-muted-foreground">{ext.blog.summary}</p>
        </div>
      )
    }
    if (key === 'stackoverflow' && ext?.stackoverflow) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-sm">Rep: <strong>{ext.stackoverflow.reputation.toLocaleString()}</strong> | Answers: {ext.stackoverflow.answerCount} | Badges: G{ext.stackoverflow.badges.gold} S{ext.stackoverflow.badges.silver} B{ext.stackoverflow.badges.bronze}</p>
          {ext.stackoverflow.topTags.length > 0 && <div className="flex gap-1 flex-wrap">{ext.stackoverflow.topTags.map((t) => <Badge key={t.name} variant="outline" className="text-xs">{t.name} ({t.score})</Badge>)}</div>}
          <p className="text-sm text-muted-foreground">{ext.stackoverflow.summary}</p>
        </div>
      )
    }
    if (key === 'companyIntel' && ext?.companyIntel) {
      const intel: CompanyIntel[] = Array.isArray(ext.companyIntel) ? ext.companyIntel : [ext.companyIntel]
      return (
        <div className="mt-3 space-y-3 border-t pt-3">
          {intel.map((ci, idx) => (
            <div key={idx} className="border-l-2 border-muted pl-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{ci.company || 'Unknown'}</p>
                <Badge variant={ci.exists ? 'secondary' : 'destructive'} className="text-xs">
                  {ci.exists ? 'Verified' : 'Not Found'}
                </Badge>
                {ci.industry && <Badge variant="outline" className="text-xs">{ci.industry}</Badge>}
                {ci.size && <Badge variant="outline" className="text-xs">{ci.size}</Badge>}
              </div>
              {ci.techStack && ci.techStack.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {ci.techStack.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              )}
              {ci.summary && <p className="text-sm text-muted-foreground">{ci.summary}</p>}
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <>
      {/* Score update indicator */}
      {streaming && matchResult && matchResult !== candidate.matchResult && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Score updated to <strong>{matchResult.overallScore}/100</strong> with new enrichment data
        </div>
      )}

      {/* Enrichment categories with integrated results */}
      {categories.map((cat) => (
        <Card key={cat.label}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{cat.label}</CardTitle>
              {cat.types.filter((t) => (urlsForType[t.key] || []).length > 0).length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runCategory(cat)}
                  disabled={cat.types.every((t) => !t.available || progress[t.key]?.status === 'running' || progress[t.key]?.status === 'queued')}
                >
                  Run All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {cat.types.map((t) => {
              const typeProgress = progress[t.key]
              const isActive = typeProgress?.status === 'running' || typeProgress?.status === 'queued'
              const hasResult = renderResult(t.key) !== null
              const typeUrls = urlsForType[t.key] || []

              return (
                <div key={t.key} className="rounded border p-3 transition-colors">
                  {/* Type header */}
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{t.label}</p>
                    {typeProgress && (
                      <Badge variant="outline" className={`text-xs ${statusColors[typeProgress.status] || ''}`}>
                        {typeProgress.status}
                      </Badge>
                    )}
                    {!typeProgress && hasResult && (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700">completed</Badge>
                    )}
                  </div>

                  {/* URLs as sub-items with per-link Run buttons */}
                  {typeUrls.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {typeUrls.map((u) => (
                        <div key={u.url} className="flex items-center justify-between gap-2 pl-2 py-0.5">
                          <a href={u.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate">{u.label}</a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs shrink-0"
                            onClick={() => runType(t.key)}
                            disabled={isActive}
                          >
                            {isActive ? 'Running...' : (hasResult || typeProgress?.status === 'completed') ? 'Re-run' : 'Run'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No URLs found in CV</p>
                  )}

                  {/* Live logs */}
                  {isActive && typeProgress?.logs && typeProgress.logs.length > 0 && (
                    <div className="mt-2 rounded border bg-muted/50 p-2 max-h-32 overflow-y-auto">
                      {typeProgress.logs.map((log, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {typeProgress?.status === 'error' && typeProgress.error && (
                    <p className="mt-1 text-xs text-red-600">{typeProgress.error}</p>
                  )}

                  {/* Inline result */}
                  {renderResult(t.key)}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </>
  )
}

function GitHubAnalysis({ raw, username }: { raw: string; username: string }) {
  try {
    const data = JSON.parse(raw)
    const { aiSummary, topProjects } = data
    if (!aiSummary && !topProjects?.length) return null

    return (
      <>
        {aiSummary && (
          <div className="rounded border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">AI Assessment</p>
            <p className="text-sm text-blue-900">{aiSummary}</p>
          </div>
        )}

        {topProjects && topProjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Top Projects (AI-analyzed)</p>
            {topProjects.map((proj: { name: string; description: string | null; language: string | null; stars: number; url?: string; languages: Record<string, number>; recentCommits: number; readmeSnippet: string | null; analysis: string | null }) => (
              <div key={proj.name} className="rounded border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={proj.url || `https://github.com/${username}/${proj.name}`} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline">{proj.name}</a>
                  {proj.language && <Badge variant="outline">{proj.language}</Badge>}
                  <span className="text-xs text-muted-foreground">{proj.stars} stars · {proj.recentCommits} commits (90d)</span>
                </div>
                {proj.languages && Object.keys(proj.languages).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {Object.keys(proj.languages).map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                )}
                {proj.description && <p className="text-sm text-muted-foreground">{proj.description}</p>}
                {proj.analysis && (
                  <div className="rounded border border-purple-200 bg-purple-50 p-2">
                    <p className="text-sm text-purple-900">{typeof proj.analysis === 'string' ? proj.analysis : JSON.stringify(proj.analysis)}</p>
                  </div>
                )}
                {proj.readmeSnippet && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">README preview</summary>
                    <pre className="mt-1 whitespace-pre-wrap text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">{proj.readmeSnippet}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    )
  } catch {
    return null
  }
}

function PdfViewer({ jobId, candidateId }: { jobId: string; candidateId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadPdf = async () => {
    setLoading(true)
    try {
      const res = await candidatesApi.getCvUrl(jobId, candidateId)
      setUrl(res.url)
    } catch {
      setUrl(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPdf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, candidateId])

  if (loading) return <p className="text-muted-foreground">Loading PDF...</p>
  if (!url) return <p className="text-muted-foreground">PDF not available.</p>

  return (
    <Card>
      <CardContent className="py-4">
        <iframe
          src={url}
          className="h-[800px] w-full rounded border"
          title="CV PDF"
        />
      </CardContent>
    </Card>
  )
}
