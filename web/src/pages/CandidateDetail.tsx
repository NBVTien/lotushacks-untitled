import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ScoreRing } from '@/components/ui/score-ring'
import { StatusBadge, RecommendationBadge } from '@/components/ui/status-badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ArrowLeft, Github, Linkedin, RefreshCw, AlertTriangle, Brain, FileText, Globe, FileCode, FileImage } from 'lucide-react'
import { candidatesApi } from '@/lib/api'
import type { Candidate } from '@lotushack/shared'

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
      <div className="space-y-4 animate-fade-up">
        <Link to={`/jobs/${jobId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <p className="text-muted-foreground">Candidate not found.</p>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const { matchResult, enrichment, links } = candidate

  return (
    <div className="space-y-6 animate-fade-up">
      <Link
        to={`/jobs/${jobId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidates
      </Link>

      {/* Header with score ring */}
      <div className="flex items-start justify-between rounded-xl border bg-card p-6 shadow-card">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{candidate.name}</h1>
            {(candidate.email || candidate.phone) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {[candidate.email, candidate.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={candidate.status} />
            {matchResult && <RecommendationBadge recommendation={matchResult.recommendation} />}
          </div>
          <div className="flex gap-2">
            {links.github && (
              <a href={links.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted">
                <Github className="h-3.5 w-3.5" /> GitHub
              </a>
            )}
            {links.linkedin && (
              <a href={links.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </a>
            )}
          </div>
        </div>
        {matchResult && (
          <ScoreRing score={matchResult.overallScore} size={110} strokeWidth={10} />
        )}
      </div>

      {/* Error state */}
      {candidate.status === 'error' && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-card">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-destructive">Processing failed</p>
              {candidate.errorMessage && (
                <p className="text-sm text-muted-foreground">{candidate.errorMessage}</p>
              )}
              {candidate.retryCount < 3 ? (
                <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Retry ({candidate.retryCount}/3)
                </Button>
              ) : (
                <p className="text-sm text-destructive">Maximum retries reached (3/3)</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing state */}
      {candidate.status !== 'completed' && candidate.status !== 'error' && (
        <Card className="shadow-card">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={candidate.status} />
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
            {candidate.progressLogs && candidate.progressLogs.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 max-h-40 overflow-y-auto">
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
          <TabsTrigger value="score" className="gap-1.5"><Brain className="h-3.5 w-3.5" /> Match</TabsTrigger>
          <TabsTrigger value="parsed" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Parsed CV</TabsTrigger>
          <TabsTrigger value="online" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> Online</TabsTrigger>
          <TabsTrigger value="cv" className="gap-1.5"><FileCode className="h-3.5 w-3.5" /> Raw CV</TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5"><FileImage className="h-3.5 w-3.5" /> PDF</TabsTrigger>
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
                  <Badge variant="outline" className="text-amber-600 border-amber-300">Enrichment missing</Badge>
                )}
              </div>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">Explanation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{matchResult.explanation}</p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-card border-l-4 border-l-emerald-500">
                  <CardHeader>
                    <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1.5 pl-4 text-sm">
                      {matchResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="shadow-card border-l-4 border-l-red-400">
                  <CardHeader>
                    <CardTitle className="text-base text-red-700 dark:text-red-400">Gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1.5 pl-4 text-sm">
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
                <Card className="shadow-card">
                  <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{candidate.parsedCV.summary}</p>
                  </CardContent>
                </Card>
              )}

              {candidate.parsedCV.skills.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.parsedCV.skills.map((s, i) => (
                        <Badge key={i} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {candidate.parsedCV.experience.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader><CardTitle className="text-base">Experience</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.parsedCV.experience.map((exp, i) => (
                      <div key={i} className="relative border-l-2 border-primary/20 pl-4">
                        <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                        <p className="font-medium">{exp.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {exp.company} · {exp.duration}
                        </p>
                        {exp.description && (
                          <p className="mt-1.5 text-sm leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {candidate.parsedCV.education.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader><CardTitle className="text-base">Education</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {candidate.parsedCV.education.map((edu, i) => (
                      <div key={i}>
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-muted-foreground">
                          {edu.school} · {edu.year}
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
          {/* Re-enrich controls */}
          {(links.github || links.linkedin) && (
            <div className="flex items-center gap-3">
              {candidate.status === 'completed' || candidate.status === 'error' ? (
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted transition-colors">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {enrichment?.github || enrichment?.linkedin ? 'Re-fetch' : 'Fetch'} {[links.github && 'GitHub', links.linkedin && 'LinkedIn'].filter(Boolean).join(' + ')}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Fetch online profile data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will fetch data from {[links.github && 'GitHub', links.linkedin && 'LinkedIn'].filter(Boolean).join(' and ')} and re-score the candidate.
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
                  <div className="flex items-center gap-2">
                    <StatusBadge status={candidate.status} />
                    <span className="text-sm text-muted-foreground">
                      {candidate.status === 'scoring' ? 'Scoring...' : 'Fetching online data...'}
                    </span>
                  </div>
                  {candidate.progressLogs && candidate.progressLogs.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                      {candidate.progressLogs.map((log, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {candidate.errorMessage?.includes('nrich') && (
                <p className="text-sm text-amber-600">{candidate.errorMessage}</p>
              )}
            </div>
          )}

          {/* GitHub */}
          {enrichment?.github && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Github className="h-4 w-4" /> @{enrichment.github.username}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enrichment.github.bio && <p className="text-sm">{enrichment.github.bio}</p>}
                {enrichment.github.topLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {enrichment.github.topLanguages.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
                  </div>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Stars: <strong className="text-foreground">{enrichment.github.totalStars}</strong></span>
                  {enrichment.github.totalContributions != null && (
                    <span>Contributions: <strong className="text-foreground">{enrichment.github.totalContributions}</strong></span>
                  )}
                </div>
                {enrichment.github.repositories.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Repositories</p>
                    {enrichment.github.repositories.map((r) => (
                      <div key={r.name} className="rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.name}</span>
                          {r.language && <Badge variant="outline" className="text-xs">{r.language}</Badge>}
                          <span className="text-muted-foreground">{r.stars} stars</span>
                        </div>
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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enrichment.linkedin.headline && <p className="font-medium">{enrichment.linkedin.headline}</p>}
                {enrichment.linkedin.summary && <p className="text-sm leading-relaxed">{enrichment.linkedin.summary}</p>}
                {enrichment.linkedin.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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

          {/* Extended Analysis */}
          <ExtendedAnalysis candidate={candidate} jobId={jobId!} candidateId={candidateId!} onAction={handleReEnrich} load={load} setForcePolling={setForcePolling} />
        </TabsContent>

        <TabsContent value="cv">
          <Card className="shadow-card">
            <CardContent className="py-6">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{candidate.cvText || 'No text extracted yet.'}</pre>
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
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Extended Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isProcessing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={candidate.status} />
                <span className="text-sm text-muted-foreground">Analysis in progress...</span>
              </div>
              {candidate.progressLogs?.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 max-h-40 overflow-y-auto">
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
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      selected.includes(t.key) ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/50'
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
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                      {!t.available && <p className="text-xs text-amber-600">No URLs found in CV</p>}
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
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Portfolio: {ext.portfolio.url}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={ext.portfolio.isOnline ? 'secondary' : 'destructive'}>{ext.portfolio.isOnline ? 'Online' : 'Offline'}</Badge>
              <Badge variant="outline">Design: {ext.portfolio.designQuality}</Badge>
              {ext.portfolio.hasResponsive && <Badge variant="outline">Responsive</Badge>}
            </div>
            {ext.portfolio.techStack.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {ext.portfolio.techStack.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            )}
            <p className="text-sm">{ext.portfolio.summary}</p>
          </CardContent>
        </Card>
      )}

      {ext?.liveProjects && ext.liveProjects.length > 0 && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Live Projects</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ext.liveProjects.map((p, i) => (
              <div key={i} className="border-l-2 border-primary/20 pl-3 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{p.name}</p>
                  <Badge variant={p.isOnline ? 'secondary' : 'destructive'} className="text-xs">{p.isOnline ? 'Online' : 'Offline'}</Badge>
                  <Badge variant="outline" className="text-xs">UI: {p.uiQuality}</Badge>
                </div>
                {p.techDetected.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">{p.techDetected.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                )}
                {p.features.length > 0 && <p className="text-xs text-muted-foreground">Features: {p.features.join(', ')}</p>}
                <p className="text-sm">{p.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ext?.blog && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Blog ({ext.blog.platform})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{ext.blog.totalPosts} posts | Writing: {ext.blog.writingQuality}</p>
            {ext.blog.topicFocus.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">{ext.blog.topicFocus.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
            )}
            {ext.blog.recentPosts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Recent posts:</p>
                {ext.blog.recentPosts.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground">- {p.title} ({p.date})</p>
                ))}
              </div>
            )}
            <p className="text-sm">{ext.blog.summary}</p>
          </CardContent>
        </Card>
      )}

      {ext?.stackoverflow && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Stack Overflow</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">Reputation: <strong>{ext.stackoverflow.reputation.toLocaleString()}</strong> | Answers: {ext.stackoverflow.answerCount}</p>
            <div className="flex gap-3 text-xs">
              <span className="text-yellow-600">Gold: {ext.stackoverflow.badges.gold}</span>
              <span className="text-gray-400">Silver: {ext.stackoverflow.badges.silver}</span>
              <span className="text-orange-600">Bronze: {ext.stackoverflow.badges.bronze}</span>
            </div>
            {ext.stackoverflow.topTags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">{ext.stackoverflow.topTags.map((t) => <Badge key={t.name} variant="outline">{t.name} ({t.score})</Badge>)}</div>
            )}
            <p className="text-sm">{ext.stackoverflow.summary}</p>
          </CardContent>
        </Card>
      )}

      {ext?.verification && ext.verification.length > 0 && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Work Verification</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ext.verification.map((v, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    v.verified === true ? 'bg-emerald-100 text-emerald-700' : v.verified === false ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {v.verified === true ? '!' : v.verified === false ? 'X' : '?'}
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
    <Card className="shadow-card">
      <CardContent className="py-4">
        <iframe
          src={url}
          className="h-[800px] w-full rounded-lg border"
          title="CV PDF"
        />
      </CardContent>
    </Card>
  )
}
