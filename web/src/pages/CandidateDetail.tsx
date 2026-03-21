import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ScoreRing } from '@/components/ui/score-ring'
import { StatusBadge, RecommendationBadge } from '@/components/ui/status-badge'
import { CandidateDetailSkeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Github,
  Linkedin,
  RefreshCw,
  AlertTriangle,
  Brain,
  FileText,
  Globe,
  FileCode,
  FileImage,
  Upload,
  Search,
  CheckCircle,
  Zap,
  Star,
  Sparkles,
  Loader2,
  MessageSquare,
  Lightbulb,
} from 'lucide-react'
import { PageTransition } from '@/components/ui/motion'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorState } from '@/components/ErrorState'
import { toast } from 'sonner'
import { candidatesApi } from '@/lib/api'
import type {
  Candidate,
  EnrichmentProgress,
  CompanyIntel,
  InterviewQuestion,
  InterviewQuestionsResult,
} from '@lotushack/shared'

const PIPELINE_STEPS = [
  { key: 'uploaded', label: 'Uploaded', icon: Upload },
  { key: 'parsed', label: 'Parsed', icon: FileText },
  { key: 'enriching', label: 'Enriched', icon: Search },
  { key: 'scoring', label: 'Scored', icon: Star },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
]

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    uploaded: 0,
    parsing: 1,
    parsed: 1,
    enriching: 2,
    scoring: 3,
    completed: 4,
    error: -1,
  }
  return map[status] ?? 0
}

export function CandidateDetailPage() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [forcePolling, setForcePolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRef = useRef<() => Promise<void>>(async () => {})
  const candidateRef = useRef(candidate)
  candidateRef.current = candidate

  loadRef.current = async () => {
    if (!jobId || !candidateId || notFound) return
    setError(null)
    try {
      const data = await candidatesApi.get(jobId, candidateId)
      setCandidate(data)
      if (forcePolling && (data.status === 'completed' || data.status === 'error')) {
        setForcePolling(false)
      }
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setNotFound(true)
      } else if (!candidateRef.current) {
        setError('Failed to load candidate details. Please try again.')
      }
    }
  }

  const isDone =
    !forcePolling && (candidate?.status === 'completed' || candidate?.status === 'error')

  useEffect(() => {
    loadRef.current?.()
    if (isDone) return
    const interval = setInterval(() => loadRef.current?.(), 3000)
    return () => clearInterval(interval)
  }, [jobId, candidateId, isDone]) // stable deps only


  const handleReEnrich = async () => {
    try {
      await candidatesApi.reEnrich(jobId!, candidateId!)
      setForcePolling(true)
      loadRef.current?.()
      toast.success('Re-enrichment started')
    } catch {
      toast.error('Failed to start re-enrichment')
    }
  }

  const handleRetry = async () => {
    try {
      await candidatesApi.retry(jobId!, candidateId!)
      setForcePolling(true)
      loadRef.current?.()
      toast.success('Retry started')
    } catch {
      toast.error('Failed to retry processing')
    }
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link
          to={`/jobs/${jobId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <p className="text-muted-foreground">Candidate not found.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          to={`/jobs/${jobId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Job
        </Link>
        <ErrorState message={error} onRetry={() => loadRef.current?.()} />
      </div>
    )
  }

  if (!candidate) {
    return <CandidateDetailSkeleton />
  }

  const { matchResult, enrichment, links } = candidate
  const currentStepIndex = getStepIndex(candidate.status)

  return (
    <PageTransition>
      <div className="space-y-8">
        <Link
          to={`/jobs/${jobId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidates
        </Link>

        {/* Pipeline stepper — simplified dots */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
          {PIPELINE_STEPS.map((step, i) => {
            const isCompleted = currentStepIndex > i
            const isCurrent = currentStepIndex === i
            const isError = candidate.status === 'error'
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ${
                      isCompleted
                        ? 'bg-primary text-primary-foreground'
                        : isCurrent && !isError
                          ? 'bg-primary ring-2 ring-primary/20 text-primary-foreground'
                          : isCurrent && isError
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : isCurrent && isError ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium ${isCurrent ? (isError ? 'text-red-500' : 'text-primary') : isCompleted ? 'text-foreground' : 'text-muted-foreground/50'}`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div
                    className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-colors ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Header with score ring - dashboard grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Score ring - prominent */}
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-6 shadow-sm">
            {matchResult ? (
              <>
                <ScoreRing score={matchResult.overallScore} size={130} strokeWidth={12} />
                <div className="mt-3">
                  <RecommendationBadge recommendation={matchResult.recommendation} />
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <Zap className="mx-auto h-8 w-8 opacity-30" />
                <p className="mt-2 text-sm">Score pending</p>
              </div>
            )}
          </div>

          {/* Candidate info */}
          <div className="md:col-span-2 rounded-xl border bg-card p-6 shadow-sm space-y-3">
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
            </div>
            <div className="flex gap-2">
              {links.github && (
                <a
                  href={links.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <Github className="h-3.5 w-3.5" /> GitHub
                </a>
              )}
              {links.linkedin && (
                <a
                  href={links.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Error state */}
        {candidate.status === 'error' && (
          <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
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
          <Card className="shadow-sm">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={candidate.status} />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
              {candidate.progressLogs && candidate.progressLogs.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 max-h-40 overflow-y-auto">
                  {candidate.progressLogs.map((log, i) => (
                    <p key={i} className="text-xs text-muted-foreground font-mono">
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="score">
          <TabsList>
            <TabsTrigger value="score" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Match
            </TabsTrigger>
            <TabsTrigger value="parsed" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Parsed CV
            </TabsTrigger>
            <TabsTrigger value="online" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Online
            </TabsTrigger>
            <TabsTrigger value="cv" className="gap-1.5">
              <FileCode className="h-3.5 w-3.5" /> Raw CV
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1.5">
              <FileImage className="h-3.5 w-3.5" /> PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="score" className="space-y-4">
            {matchResult ? (
              <>
                {/* Scoring Methodology Notice */}
                <Card className="shadow-sm border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/10">
                  <CardContent className="py-3 px-4">
                    <details className="group">
                      <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-300 select-none">
                        <Brain className="h-4 w-4" />
                        How is this score calculated?
                        {matchResult.scoringBasis && (
                          <Badge variant="outline" className={`ml-2 text-xs ${
                            matchResult.scoringBasis.confidence === 'high' ? 'text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700' :
                            matchResult.scoringBasis.confidence === 'medium' ? 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700' :
                            'text-red-600 border-red-300 dark:text-red-400 dark:border-red-700'
                          }`}>
                            {matchResult.scoringBasis.confidence} confidence
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-blue-500 group-open:hidden">Click to expand</span>
                      </summary>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>Score generated by <strong>AI (GPT-4o-mini)</strong> based on:</p>
                        <div className="grid gap-2 sm:grid-cols-2 mt-2">
                          <div className="rounded-md border bg-background/50 p-2.5">
                            <p className="font-medium text-foreground mb-1">Data Sources Used</p>
                            <ul className="space-y-0.5 text-xs">
                              {matchResult.scoringBasis?.dataSources ? matchResult.scoringBasis.dataSources.map((src, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500 mt-0.5" /> {src}
                                </li>
                              )) : (
                                <>
                                  <li className="flex items-center gap-1.5"><FileText className="h-3 w-3 shrink-0" /> CV content</li>
                                  {enrichment?.github && <li className="flex items-center gap-1.5"><Github className="h-3 w-3 shrink-0" /> GitHub profile</li>}
                                  {enrichment?.linkedin && <li className="flex items-center gap-1.5"><Linkedin className="h-3 w-3 shrink-0" /> LinkedIn profile</li>}
                                </>
                              )}
                            </ul>
                          </div>
                          <div className="rounded-md border bg-background/50 p-2.5">
                            <p className="font-medium text-foreground mb-1">Evaluation Criteria</p>
                            <ul className="space-y-0.5 text-xs">
                              {matchResult.scoringBasis?.scoringCriteria && matchResult.scoringBasis.scoringCriteria.length > 0
                                ? matchResult.scoringBasis.scoringCriteria.map((c, i) => (
                                  <li key={i}>• {c}</li>
                                ))
                                : (
                                <>
                                  <li>• Skills alignment with job requirements</li>
                                  <li>• Relevant work experience</li>
                                  <li>• Open-source contributions</li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                        {matchResult.scoringBasis?.limitations && matchResult.scoringBasis.limitations.length > 0 && (
                          <div className="rounded-md border border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/10 p-2.5">
                            <p className="font-medium text-amber-700 dark:text-amber-300 mb-1 text-xs">Limitations</p>
                            <ul className="space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
                              {matchResult.scoringBasis.limitations.map((l, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {l}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-xs">80-100: Strong Match</Badge>
                          <Badge variant="outline" className="text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700 text-xs">60-79: Good Match</Badge>
                          <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs">40-59: Partial Match</Badge>
                          <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 text-xs">0-39: Weak Match</Badge>
                        </div>
                      </div>
                    </details>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Based on: CV</Badge>
                  {candidate.parsedCV && (
                    <Badge variant="secondary">AI-parsed skills & experience</Badge>
                  )}
                  {enrichment?.github && <Badge variant="secondary">GitHub profile</Badge>}
                  {enrichment?.linkedin && <Badge variant="secondary">LinkedIn profile</Badge>}
                  {!enrichment?.github && !enrichment?.linkedin && links.github && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Enrichment missing
                    </Badge>
                  )}
                </div>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Explanation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {matchResult.explanation}
                    </p>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="shadow-sm bg-emerald-50/50 dark:bg-emerald-950/10">
                    <CardHeader>
                      <CardTitle className="text-base">Strengths</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc space-y-1.5 pl-4 text-sm">
                        {matchResult.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm bg-red-50/50 dark:bg-red-950/10">
                    <CardHeader>
                      <CardTitle className="text-base">Gaps</CardTitle>
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

                {/* Improvement Tips */}
                {matchResult.improvementTips && matchResult.improvementTips.length > 0 && (
                  <Card className="shadow-sm bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/30">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Profile Improvement Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {matchResult.improvementTips.map((tip, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08, duration: 0.3 }}
                            className="flex gap-3 items-start rounded-md border-l-3 border-amber-400 bg-white/60 dark:bg-white/5 px-3 py-2"
                          >
                            <span className="mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                              {i + 1}.
                            </span>
                            <p className="text-sm text-foreground/80 leading-relaxed">{tip}</p>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Skill Match Checklist */}
                {matchResult.skillScores && matchResult.skillScores.length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Skill Match</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI-evaluated against job requirements
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {matchResult.skillScores.map((skill, i) => (
                          <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2 ${
                            skill.level === 'yes' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' :
                            skill.level === 'partial' ? 'bg-amber-50/50 dark:bg-amber-950/10' :
                            'bg-red-50/50 dark:bg-red-950/10'
                          }`}>
                            <div className="shrink-0 mt-0.5">
                              {skill.level === 'yes' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                              {skill.level === 'partial' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                              {skill.level === 'no' && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-red-400 text-red-400 text-[10px] font-bold">✕</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{skill.name}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{skill.evidence}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" /> Has skill</span>
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Partial</span>
                        <span className="flex items-center gap-1"><span className="inline-flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-400 text-red-400 text-[8px] font-bold">✕</span> Missing</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Interview Questions */}
                <InterviewQuestionsSection
                  jobId={jobId!}
                  candidateId={candidateId!}
                  cached={candidate.interviewQuestions}
                  onGenerated={(result) =>
                    setCandidate((prev) =>
                      prev ? { ...prev, interviewQuestions: result } : prev
                    )
                  }
                />
              </>
            ) : (
              <p className="text-muted-foreground">Score not yet available.</p>
            )}
          </TabsContent>

          <TabsContent value="parsed" className="space-y-4">
            {candidate.parsedCV ? (
              <>
                {candidate.parsedCV.summary && (
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{candidate.parsedCV.summary}</p>
                    </CardContent>
                  </Card>
                )}

                {candidate.parsedCV.skills.length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Skills</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.parsedCV.skills.map((s, i) => (
                          <Badge key={i} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {candidate.parsedCV.experience.length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Experience</CardTitle>
                    </CardHeader>
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
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Education</CardTitle>
                    </CardHeader>
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
                      {enrichment?.github || enrichment?.linkedin ? 'Re-fetch' : 'Fetch'}{' '}
                      {[links.github && 'GitHub', links.linkedin && 'LinkedIn']
                        .filter(Boolean)
                        .join(' + ')}
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Fetch online profile data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will fetch data from{' '}
                          {[links.github && 'GitHub', links.linkedin && 'LinkedIn']
                            .filter(Boolean)
                            .join(' and ')}{' '}
                          and re-score the candidate.
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
                          <p key={i} className="text-xs text-muted-foreground font-mono">
                            {log}
                          </p>
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
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Github className="h-4 w-4" /> @{enrichment.github.username}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {enrichment.github.bio && <p className="text-sm">{enrichment.github.bio}</p>}
                  {enrichment.github.topLanguages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.github.topLanguages.map((l) => (
                        <Badge key={l} variant="secondary">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>
                      Stars:{' '}
                      <strong className="text-foreground">{enrichment.github.totalStars}</strong>
                    </span>
                    {enrichment.github.totalContributions != null && (
                      <span>
                        Contributions:{' '}
                        <strong className="text-foreground">
                          {enrichment.github.totalContributions}
                        </strong>
                      </span>
                    )}
                  </div>
                  <GitHubAnalysis
                    raw={enrichment.github.raw}
                    username={enrichment.github.username}
                  />
                  {enrichment.github.repositories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Repositories</p>
                      {enrichment.github.repositories.map((r) => (
                        <div key={r.name} className="rounded-lg bg-muted/40 p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.name}</span>
                            {r.language && (
                              <Badge variant="outline" className="text-xs">
                                {r.language}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">{r.stars} stars</span>
                          </div>
                          {r.description && (
                            <p className="mt-1 text-muted-foreground">{r.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* LinkedIn */}
            {enrichment?.linkedin &&
              (enrichment.linkedin.headline ||
                enrichment.linkedin.summary ||
                enrichment.linkedin.experience.length > 0 ||
                enrichment.linkedin.skills.length > 0) && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Linkedin className="h-4 w-4" /> LinkedIn
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {enrichment.linkedin.headline && (
                      <p className="font-medium">{enrichment.linkedin.headline}</p>
                    )}
                    {enrichment.linkedin.summary && (
                      <p className="text-sm leading-relaxed">{enrichment.linkedin.summary}</p>
                    )}
                    {enrichment.linkedin.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {enrichment.linkedin.skills.map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {enrichment.linkedin.experience.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">Experience</p>
                        <ul className="list-disc pl-4 text-sm">
                          {enrichment.linkedin.experience.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            {/* Extended Analysis */}
            <ExtendedAnalysis
              candidate={candidate}
              jobId={jobId!}
              candidateId={candidateId!}
              onAction={handleReEnrich}
              load={() => loadRef.current?.()}
              setForcePolling={setForcePolling}
            />
          </TabsContent>

          <TabsContent value="cv">
            <Card className="shadow-sm">
              <CardContent className="py-6">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                  {candidate.cvText || 'No text extracted yet.'}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf">
            <PdfViewer jobId={jobId!} candidateId={candidateId!} />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  )
}

const CATEGORY_STYLES: Record<
  InterviewQuestion['category'],
  { bg: string; text: string; border: string; label: string }
> = {
  technical: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Technical',
  },
  behavioral: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Behavioral',
  },
  experience: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Experience',
  },
  'gap-exploration': {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    label: 'Gap Exploration',
  },
}

function InterviewQuestionsSection({
  jobId,
  candidateId,
  cached,
  onGenerated,
}: {
  jobId: string
  candidateId: string
  cached: InterviewQuestionsResult | null
  onGenerated: (result: InterviewQuestionsResult) => void
}) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>(
    cached?.questions ?? []
  )
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(!!cached)

  // Sync if cached data arrives later (e.g. from polling)
  useEffect(() => {
    if (cached?.questions && !hasGenerated) {
      setQuestions(cached.questions)
      setHasGenerated(true)
    }
  }, [cached, hasGenerated])

  const generate = async () => {
    setLoading(true)
    try {
      const result = await candidatesApi.generateInterviewQuestions(jobId, candidateId)
      setQuestions(result.questions)
      setHasGenerated(true)
      onGenerated(result)
      toast.success('Interview questions generated')
    } catch {
      toast.error('Failed to generate interview questions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Interview Questions
          </CardTitle>
          {hasGenerated && (
            <Button
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasGenerated && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-1 font-medium">AI-Generated Interview Questions</p>
            <p className="mb-5 max-w-sm text-sm text-muted-foreground">
              Generate tailored interview questions based on this candidate's profile,
              match analysis, and identified gaps.
            </p>
            <Button onClick={generate} disabled={loading} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Interview Questions
            </Button>
          </div>
        )}

        {loading && !hasGenerated && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Analyzing candidate profile and generating questions...
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {hasGenerated && questions.length > 0 && (
            <motion.div
              key="questions-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {questions.map((q, i) => {
                const style = CATEGORY_STYLES[q.category] || CATEGORY_STYLES.technical
                return (
                  <motion.div
                    key={`${q.category}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3, ease: 'easeOut' }}
                  >
                    <div
                      className={`rounded-lg border p-4 transition-colors hover:bg-muted/30 ${style.border}`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Q{i + 1}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${style.bg} ${style.text} ${style.border}`}
                        >
                          {style.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">
                        {q.question}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {q.rationale}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
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
  candidate,
  jobId,
  candidateId,
  load,
}: {
  candidate: Candidate
  jobId: string
  candidateId: string
  onAction: () => void
  load: () => void
  setForcePolling: (v: boolean) => void
}) {
  const ext = candidate.extendedEnrichment
  const hasPortfolioUrls = (candidate.links.portfolio?.length || 0) > 0
  const hasLinkedIn = !!candidate.links.linkedin

  // SSE streaming state
  const [liveProgress, setLiveProgress] = useState<EnrichmentProgress>(
    candidate.enrichmentProgress || {}
  )
  const [liveCandidate, setLiveCandidate] = useState<Partial<Candidate>>({})
  const eventSourceRef = useRef<EventSource | null>(null)
  const [streaming, setStreaming] = useState(false)

  // Merge live data with candidate data
  const progress = { ...(candidate.enrichmentProgress || {}), ...liveProgress }
  const hasRunning = Object.values(progress).some(
    (p) => p.status === 'running' || p.status === 'queued'
  )

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
      } catch {
        /* ignore parse errors */
      }
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
  const isSourceCodeUrl = (u: string) =>
    /github\.com|gitlab\.com|bitbucket\.org|youtu\.be|youtube\.com/i.test(u)

  // Build URL lists per enrichment type
  // Build company experience entries for companyIntel
  const companyEntries = (candidate.parsedCV?.experience || []).map((exp) => ({
    url: '#',
    label: `${exp.company} (${exp.title})`,
  }))

  const urlsForType: Record<string, { url: string; label: string }[]> = {
    linkedin: candidate.links.linkedin
      ? [
          {
            url: candidate.links.linkedin,
            label: candidate.links.linkedin.replace(/https?:\/\/(www\.)?/, ''),
          },
        ]
      : [],
    companyIntel: companyEntries,
    portfolio: classified
      .filter((c) => c.kind === 'portfolio' || c.kind === 'company')
      .map((c) => ({ url: c.url, label: c.label })),
    blog: [
      ...classified.filter((c) => c.kind === 'blog').map((c) => ({ url: c.url, label: c.label })),
      ...portfolioUrls
        .filter(
          (u) =>
            /dev\.to|medium\.com|hashnode|blog/i.test(u) && !classified.some((c) => c.url === u)
        )
        .map((u) => ({ url: u, label: new URL(u).hostname })),
    ],
    stackoverflow: portfolioUrls
      .filter((u) => /stackoverflow\.com/i.test(u))
      .map((u) => ({ url: u, label: 'Stack Overflow' })),
    liveProjects: [
      // Only include non-source-code URLs classified as projects
      ...classified
        .filter((c) => c.kind === 'project' && !isSourceCodeUrl(c.url))
        .map((c) => ({ url: c.url, label: c.label })),
      // Fallback: non-classified portfolio URLs that are NOT source code repos
      ...portfolioUrls
        .filter(
          (u) =>
            !isSourceCodeUrl(u) &&
            !classified.some((c) => c.url === u) &&
            !/stackoverflow|dev\.to|medium\.com|hashnode|blog/i.test(u)
        )
        .map((u) => {
          try {
            return { url: u, label: new URL(u).hostname }
          } catch {
            return { url: u, label: u }
          }
        }),
    ],
  }
  // If no classified data, fall back — but still exclude source code URLs from live projects
  if (classified.length === 0 && portfolioUrls.length > 0) {
    const nonCodeUrls = portfolioUrls
      .filter((u) => !isSourceCodeUrl(u))
      .map((u) => {
        try {
          return { url: u, label: new URL(u).hostname }
        } catch {
          return { url: u, label: u }
        }
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
        {
          key: 'linkedin',
          label: 'LinkedIn',
          desc: 'Crawl LinkedIn profile via TinyFish',
          available: hasLinkedIn,
        },
      ],
    },
    {
      label: 'Web Presence',
      types: [
        {
          key: 'portfolio',
          label: 'Portfolio / Websites',
          desc: 'Analyze websites found in CV',
          available: urlsForType.portfolio.length > 0 || hasPortfolioUrls,
        },
        {
          key: 'blog',
          label: 'Blog / Articles',
          desc: 'Analyze dev.to, Medium, Hashnode posts',
          available: hasBlogUrls || hasPortfolioUrls,
        },
        {
          key: 'stackoverflow',
          label: 'Stack Overflow',
          desc: 'Check SO reputation, badges, top tags',
          available: hasSOUrls || hasPortfolioUrls,
        },
      ],
    },
    {
      label: 'Projects',
      types: [
        {
          key: 'liveProjects',
          label: 'Live Projects',
          desc: 'Visit deployed apps & products from CV',
          available: hasProjectUrls,
        },
      ],
    },
    {
      label: 'Company Verification',
      types: [
        {
          key: 'companyIntel',
          label: 'Company Intel',
          desc: 'Verify companies from candidate experience',
          available: (candidate.parsedCV?.experience?.length || 0) > 0,
        },
      ],
    },
  ]

  const runType = async (type: string) => {
    try {
      await candidatesApi.extendedEnrich(jobId, candidateId, [type])
      setLiveProgress((prev) => ({ ...prev, [type]: { status: 'queued', logs: [] } }))
      toast.success(`Extended enrichment started: ${type}`)
    } catch {
      toast.error(`Failed to start enrichment: ${type}`)
    }
  }

  const runCategory = async (cat: EnrichmentCategory) => {
    const available = cat.types.filter((t) => t.available).map((t) => t.key)
    if (available.length === 0) return
    try {
      await candidatesApi.extendedEnrich(jobId, candidateId, available)
      setLiveProgress((prev) => {
        const next = { ...prev }
        for (const key of available) next[key] = { status: 'queued', logs: [] }
        return next
      })
      toast.success(`Extended enrichment started: ${cat.label}`)
    } catch {
      toast.error(`Failed to start enrichment: ${cat.label}`)
    }
  }

  // Helper to render inline result for a type
  const renderResult = (key: string) => {
    const li = enrichment?.linkedin
    if (
      key === 'linkedin' &&
      li &&
      (li.headline || li.summary || li.experience.length > 0 || li.skills.length > 0)
    ) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          {li.headline && <p className="font-medium text-sm">{li.headline}</p>}
          {li.summary && <p className="text-sm text-muted-foreground">{li.summary}</p>}
          {li.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {li.skills.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {li.experience.length > 0 && (
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              {li.experience.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    if (key === 'portfolio' && ext?.portfolio) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={ext.portfolio.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium hover:underline"
            >
              {ext.portfolio.url}
            </a>
            <Badge
              variant={ext.portfolio.isOnline ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {ext.portfolio.isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Design: {ext.portfolio.designQuality}
            </Badge>
            {ext.portfolio.hasResponsive && (
              <Badge variant="outline" className="text-xs">
                Responsive
              </Badge>
            )}
          </div>
          {ext.portfolio.techStack.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {ext.portfolio.techStack.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
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
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sm hover:underline"
                >
                  {p.name}
                </a>
                <Badge variant={p.isOnline ? 'secondary' : 'destructive'} className="text-xs">
                  {p.isOnline ? 'Online' : 'Offline'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  UI: {p.uiQuality}
                </Badge>
              </div>
              {p.techDetected.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {p.techDetected.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              {p.features.length > 0 && (
                <p className="text-xs text-muted-foreground">Features: {p.features.join(', ')}</p>
              )}
              <p className="text-sm text-muted-foreground">{p.summary}</p>
            </div>
          ))}
        </div>
      )
    }
    if (key === 'blog' && ext?.blog) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">
            {ext.blog.platform} | {ext.blog.totalPosts} posts | Writing: {ext.blog.writingQuality}
          </p>
          {ext.blog.topicFocus.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {ext.blog.topicFocus.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          {ext.blog.recentPosts.length > 0 &&
            ext.blog.recentPosts.map((p, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {p.title} ({p.date})
              </p>
            ))}
          <p className="text-sm text-muted-foreground">{ext.blog.summary}</p>
        </div>
      )
    }
    if (key === 'stackoverflow' && ext?.stackoverflow) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-sm">
            Rep: <strong>{ext.stackoverflow.reputation.toLocaleString()}</strong> | Answers:{' '}
            {ext.stackoverflow.answerCount} | Badges: G{ext.stackoverflow.badges.gold} S
            {ext.stackoverflow.badges.silver} B{ext.stackoverflow.badges.bronze}
          </p>
          {ext.stackoverflow.topTags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {ext.stackoverflow.topTags.map((t) => (
                <Badge key={t.name} variant="outline" className="text-xs">
                  {t.name} ({t.score})
                </Badge>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{ext.stackoverflow.summary}</p>
        </div>
      )
    }
    if (key === 'companyIntel' && ext?.companyIntel) {
      const intel: CompanyIntel[] = Array.isArray(ext.companyIntel)
        ? ext.companyIntel
        : [ext.companyIntel]
      return (
        <div className="mt-3 space-y-3 border-t pt-3">
          {intel.map((ci, idx) => (
            <div key={idx} className="border-l-2 border-muted pl-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{ci.company || 'Unknown'}</p>
                <Badge variant={ci.exists ? 'secondary' : 'destructive'} className="text-xs">
                  {ci.exists ? 'Verified' : 'Not Found'}
                </Badge>
                {ci.industry && (
                  <Badge variant="outline" className="text-xs">
                    {ci.industry}
                  </Badge>
                )}
                {ci.size && (
                  <Badge variant="outline" className="text-xs">
                    {ci.size}
                  </Badge>
                )}
              </div>
              {ci.techStack && ci.techStack.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {ci.techStack.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
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
        <div className="rounded-lg border bg-muted/50 p-3 text-sm text-foreground shadow-sm">
          Score updated to <strong>{matchResult.overallScore}/100</strong> with new enrichment data
        </div>
      )}

      {/* Enrichment categories with integrated results */}
      {categories.map((cat) => (
        <Card key={cat.label} className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{cat.label}</CardTitle>
              {cat.types.filter((t) => (urlsForType[t.key] || []).length > 0).length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runCategory(cat)}
                  disabled={cat.types.every(
                    (t) =>
                      !t.available ||
                      progress[t.key]?.status === 'running' ||
                      progress[t.key]?.status === 'queued'
                  )}
                >
                  Run All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {cat.types.map((t) => {
              const typeProgress = progress[t.key]
              const isActive =
                typeProgress?.status === 'running' || typeProgress?.status === 'queued'
              const hasResult = renderResult(t.key) !== null
              const typeUrls = urlsForType[t.key] || []

              return (
                <div
                  key={t.key}
                  className="rounded-lg border p-3 transition-colors hover:bg-muted/20"
                >
                  {/* Type header */}
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{t.label}</p>
                    {typeProgress && typeProgress.status === 'completed' && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500/70" />
                    )}
                    {typeProgress && typeProgress.status === 'error' && (
                      <span className="text-red-500/70 text-sm font-medium">&times;</span>
                    )}
                    {!typeProgress && hasResult && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500/70" />
                    )}
                    {typeProgress &&
                      (typeProgress.status === 'running' || typeProgress.status === 'queued') && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[typeProgress.status] || ''}`}
                        >
                          {typeProgress.status}
                        </Badge>
                      )}
                  </div>

                  {/* URLs as sub-items with per-link Run buttons */}
                  {typeUrls.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {typeUrls.map((u) => (
                        <div
                          key={u.url}
                          className="flex items-center justify-between gap-2 pl-2 py-0.5"
                        >
                          <a
                            href={u.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate"
                          >
                            {u.label}
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs shrink-0"
                            onClick={() => runType(t.key)}
                            disabled={isActive}
                          >
                            {isActive
                              ? 'Running...'
                              : hasResult || typeProgress?.status === 'completed'
                                ? 'Re-run'
                                : 'Run'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No URLs found in CV</p>
                  )}

                  {/* Live logs */}
                  {isActive && typeProgress?.logs && typeProgress.logs.length > 0 && (
                    <div className="mt-2 rounded-lg border bg-muted/30 p-2 max-h-32 overflow-y-auto">
                      {typeProgress.logs.map((log, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">
                          {log}
                        </p>
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
          <div className="rounded border bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">AI Assessment</p>
            <p className="text-sm">{aiSummary}</p>
          </div>
        )}

        {topProjects && topProjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Top Projects (AI-analyzed)</p>
            {topProjects.map(
              (proj: {
                name: string
                description: string | null
                language: string | null
                stars: number
                url?: string
                languages: Record<string, number>
                recentCommits: number
                readmeSnippet: string | null
                analysis: string | null
              }) => (
                <div key={proj.name} className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={proj.url || `https://github.com/${username}/${proj.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sm hover:underline"
                    >
                      {proj.name}
                    </a>
                    {proj.language && <Badge variant="outline">{proj.language}</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {proj.stars} stars · {proj.recentCommits} commits (90d)
                    </span>
                  </div>
                  {proj.languages && Object.keys(proj.languages).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {Object.keys(proj.languages).map((lang) => (
                        <Badge key={lang} variant="secondary" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {proj.description && (
                    <p className="text-sm text-muted-foreground">{proj.description}</p>
                  )}
                  {proj.analysis && (
                    <div className="rounded border bg-muted/50 p-2">
                      <p className="text-sm">
                        {typeof proj.analysis === 'string'
                          ? proj.analysis
                          : JSON.stringify(proj.analysis)}
                      </p>
                    </div>
                  )}
                  {proj.readmeSnippet && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        README preview
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                        {proj.readmeSnippet}
                      </pre>
                    </details>
                  )}
                </div>
              )
            )}
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
    <Card className="shadow-sm">
      <CardContent className="py-4">
        <iframe src={url} className="h-[800px] w-full rounded-lg border" title="CV PDF" />
      </CardContent>
    </Card>
  )
}
