import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { candidatesApi } from '@/lib/api'
import type { Candidate } from '@lotushack/shared'

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
          {/* Re-enrich GitHub + LinkedIn */}
          {(links.github || links.linkedin) && (
            <div className="flex items-center gap-3">
              {candidate.status === 'completed' || candidate.status === 'error' ? (
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                    {enrichment?.github || enrichment?.linkedin ? 'Re-fetch' : 'Fetch'} {[links.github && 'GitHub', links.linkedin && 'LinkedIn'].filter(Boolean).join(' + ')}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Fetch online profile data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will fetch data from {[links.github && 'GitHub', links.linkedin && 'LinkedIn'].filter(Boolean).join(' and ')} and re-score the candidate. This may take a few minutes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReEnrich}>Start</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : ['enriching', 'scoring'].includes(candidate.status) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {candidate.status === 'scoring' ? 'Scoring...' : 'Fetching online data...'} (may take a few minutes)
                  </p>
                  {candidate.progressLogs && candidate.progressLogs.length > 0 && (
                    <div className="rounded border bg-muted/50 p-3 max-h-48 overflow-y-auto">
                      {candidate.progressLogs.map((log, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {candidate.errorMessage?.includes('nrich') && (
                <p className="text-sm text-yellow-600">{candidate.errorMessage}</p>
              )}
            </div>
          )}

          {/* GitHub */}
          {enrichment?.github && (
            <Card>
              <CardHeader><CardTitle className="text-base">GitHub: @{enrichment.github.username}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {enrichment.github.bio && <p className="text-sm">{enrichment.github.bio}</p>}
                {enrichment.github.topLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {enrichment.github.topLanguages.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Total stars: {enrichment.github.totalStars}
                  {enrichment.github.totalContributions != null && ` | Contributions: ${enrichment.github.totalContributions}`}
                </p>
                {enrichment.github.repositories.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Repositories</p>
                    {enrichment.github.repositories.map((r) => (
                      <div key={r.name} className="rounded bg-muted p-2 text-sm">
                        <span className="font-medium">{r.name}</span>
                        {r.language && <Badge variant="outline" className="ml-2">{r.language}</Badge>}
                        <span className="ml-2 text-muted-foreground">{r.stars} stars</span>
                        {r.description && <p className="mt-1 text-muted-foreground">{r.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* LinkedIn */}
          {enrichment?.linkedin && (enrichment.linkedin.headline || enrichment.linkedin.summary || enrichment.linkedin.experience.length > 0 || enrichment.linkedin.skills.length > 0) && (
            <Card>
              <CardHeader><CardTitle className="text-base">LinkedIn</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {enrichment.linkedin.headline && <p className="font-medium">{enrichment.linkedin.headline}</p>}
                {enrichment.linkedin.summary && <p className="text-sm">{enrichment.linkedin.summary}</p>}
                {enrichment.linkedin.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {enrichment.linkedin.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                )}
                {enrichment.linkedin.experience.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Experience</p>
                    <ul className="list-disc pl-4 text-sm">
                      {enrichment.linkedin.experience.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Separator between auto + extended */}
          {(enrichment?.github || enrichment?.linkedin) && <Separator />}

          {/* Extended Analysis */}
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

function ExtendedAnalysis({
  candidate, jobId, candidateId, load, setForcePolling,
}: {
  candidate: Candidate; jobId: string; candidateId: string;
  onAction: () => void; load: () => void; setForcePolling: (v: boolean) => void;
}) {
  const ext = candidate.extendedEnrichment
  const hasPortfolioUrls = (candidate.links.portfolio?.length || 0) > 0
  const isProcessing = ['enriching', 'scoring'].includes(candidate.status)

  const enrichmentTypes = [
    { key: 'portfolio', label: 'Portfolio Website', available: hasPortfolioUrls, desc: 'Analyze portfolio/personal website design and tech' },
    { key: 'liveProjects', label: 'Live Projects', available: hasPortfolioUrls, desc: 'Visit deployed apps, check if they work' },
    { key: 'blog', label: 'Blog / Articles', available: hasPortfolioUrls, desc: 'Analyze dev.to, Medium, Hashnode posts' },
    { key: 'stackoverflow', label: 'Stack Overflow', available: hasPortfolioUrls, desc: 'Check SO reputation, badges, top tags' },
    { key: 'verification', label: 'Work Verification', available: !!(candidate.parsedCV?.experience?.length), desc: 'Verify work history via company websites' },
  ]

  const [selected, setSelected] = useState<string[]>([])

  const runExtended = async () => {
    if (selected.length === 0) return
    await candidatesApi.extendedEnrich(jobId, candidateId, selected)
    setForcePolling(true)
    load()
    setSelected([])
  }

  return (
    <>
      {/* Run controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Extended Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isProcessing ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Analysis in progress...</p>
              {candidate.progressLogs?.length > 0 && (
                <div className="rounded border bg-muted/50 p-3 max-h-40 overflow-y-auto">
                  {candidate.progressLogs.map((log, i) => (
                    <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                {enrichmentTypes.map((t) => (
                  <label
                    key={t.key}
                    className={`flex items-start gap-2 rounded border p-3 cursor-pointer transition-colors ${
                      selected.includes(t.key) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    } ${!t.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(t.key)}
                      disabled={!t.available}
                      onChange={(e) => {
                        if (e.target.checked) setSelected([...selected, t.key])
                        else setSelected(selected.filter((s) => s !== t.key))
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                      {!t.available && <p className="text-xs text-yellow-600">No URLs found in CV</p>}
                    </div>
                  </label>
                ))}
              </div>
              <Button onClick={runExtended} disabled={selected.length === 0} size="sm">
                Run {selected.length} analysis{selected.length !== 1 ? 'es' : ''}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {ext?.portfolio && (
        <Card>
          <CardHeader><CardTitle className="text-base">Portfolio: {ext.portfolio.url}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={ext.portfolio.isOnline ? 'secondary' : 'destructive'}>{ext.portfolio.isOnline ? 'Online' : 'Offline'}</Badge>
              <Badge variant="outline">Design: {ext.portfolio.designQuality}</Badge>
              {ext.portfolio.hasResponsive && <Badge variant="outline">Responsive</Badge>}
            </div>
            {ext.portfolio.techStack.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {ext.portfolio.techStack.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            )}
            <p className="text-sm">{ext.portfolio.summary}</p>
          </CardContent>
        </Card>
      )}

      {ext?.liveProjects && ext.liveProjects.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Live Projects</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ext.liveProjects.map((p, i) => (
              <div key={i} className="border-l-2 pl-3 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{p.name}</p>
                  <Badge variant={p.isOnline ? 'secondary' : 'destructive'} className="text-xs">{p.isOnline ? 'Online' : 'Offline'}</Badge>
                  <Badge variant="outline" className="text-xs">UI: {p.uiQuality}</Badge>
                </div>
                {p.techDetected.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{p.techDetected.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                )}
                {p.features.length > 0 && <p className="text-xs text-muted-foreground">Features: {p.features.join(', ')}</p>}
                <p className="text-sm">{p.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ext?.blog && (
        <Card>
          <CardHeader><CardTitle className="text-base">Blog ({ext.blog.platform})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{ext.blog.totalPosts} posts | Writing: {ext.blog.writingQuality}</p>
            {ext.blog.topicFocus.length > 0 && (
              <div className="flex gap-1 flex-wrap">{ext.blog.topicFocus.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
            )}
            {ext.blog.recentPosts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Recent posts:</p>
                {ext.blog.recentPosts.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {p.title} ({p.date})</p>
                ))}
              </div>
            )}
            <p className="text-sm">{ext.blog.summary}</p>
          </CardContent>
        </Card>
      )}

      {ext?.stackoverflow && (
        <Card>
          <CardHeader><CardTitle className="text-base">Stack Overflow</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">Reputation: <strong>{ext.stackoverflow.reputation.toLocaleString()}</strong> | Answers: {ext.stackoverflow.answerCount}</p>
            <div className="flex gap-2 text-xs">
              <span className="text-yellow-600">🥇 {ext.stackoverflow.badges.gold}</span>
              <span className="text-gray-400">🥈 {ext.stackoverflow.badges.silver}</span>
              <span className="text-orange-600">🥉 {ext.stackoverflow.badges.bronze}</span>
            </div>
            {ext.stackoverflow.topTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">{ext.stackoverflow.topTags.map((t) => <Badge key={t.name} variant="outline">{t.name} ({t.score})</Badge>)}</div>
            )}
            <p className="text-sm">{ext.stackoverflow.summary}</p>
          </CardContent>
        </Card>
      )}

      {ext?.verification && ext.verification.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Work Verification</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ext.verification.map((v, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={v.verified === true ? 'text-green-600' : v.verified === false ? 'text-red-600' : 'text-yellow-600'}>
                    {v.verified === true ? '✓' : v.verified === false ? '✗' : '?'}
                  </span>
                  <div>
                    <p className="font-medium">{v.company} — {v.claimed}</p>
                    <p className="text-muted-foreground text-xs">{v.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!ext && !isProcessing && (
        <p className="text-sm text-muted-foreground">No extended analysis run yet. Select analysis types above and click Run.</p>
      )}
    </>
  )
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
