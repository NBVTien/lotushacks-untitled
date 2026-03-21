import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// Select imports removed — pipeline stage now uses visual tracker buttons
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
  FileCode,
  Upload,
  Search,
  CheckCircle,
  Zap,
  Clock,
  Sparkles,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PageTransition } from '@/components/ui/motion'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorState } from '@/components/ErrorState'
import { toast } from 'sonner'
import { candidatesApi } from '@/lib/api'
import { CandidateNotes } from '@/components/CandidateNotes'
import type {
  Candidate,
  EnrichmentProgress,
  CompanyIntel,
  InterviewQuestion,
  InterviewQuestionsResult,
  PipelineStage,
  SurveyAnswer,
} from '@lotushack/shared'

const PIPELINE_STEPS = [
  { key: 'uploaded', label: 'Uploaded', icon: Upload },
  { key: 'parsed', label: 'Parsed', icon: FileText },
  { key: 'enriching', label: 'Enriched', icon: Search },
  { key: 'scoring', label: 'Scored', icon: Brain },
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
          to={`/recruiter/jobs/${jobId}`}
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
          to={`/recruiter/jobs/${jobId}`}
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
          to={`/recruiter/jobs/${jobId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidates
        </Link>

        {/* Compact header — score + info + enrichment signals in one row */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col md:flex-row gap-5">
            {/* Score ring — compact */}
            <div className="flex flex-col items-center justify-center shrink-0">
              {matchResult ? (
                <>
                  <ScoreRing score={matchResult.overallScore} size={100} strokeWidth={10} />
                  <div className="mt-2">
                    <RecommendationBadge recommendation={matchResult.recommendation} />
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Clock className="mx-auto h-6 w-6 opacity-30" />
                  <p className="mt-1 text-xs">Pending</p>
                </div>
              )}
            </div>

            {/* Candidate info + status + links */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{candidate.name}</h1>
                  {(candidate.email || candidate.phone) && (
                    <p className="text-sm text-muted-foreground">
                      {[candidate.email, candidate.phone].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <StatusBadge status={candidate.status} />
              </div>

              {/* Pipeline progress — inline compact */}
              <div className="flex items-center gap-1">
                {PIPELINE_STEPS.map((step, i) => {
                  const isCompleted = currentStepIndex > i
                  const isCurrent = currentStepIndex === i
                  const isError = candidate.status === 'error'
                  return (
                    <div key={step.key} className="flex items-center">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                          isCompleted
                            ? 'bg-primary text-primary-foreground'
                            : isCurrent && !isError
                              ? 'bg-primary ring-1 ring-primary/30 text-primary-foreground'
                              : isCurrent && isError
                                ? 'bg-red-500 text-white'
                                : 'bg-muted text-muted-foreground/50'
                        }`}
                        title={step.label}
                      >
                        {isCompleted ? <CheckCircle className="h-3 w-3" /> : isCurrent && isError ? <AlertTriangle className="h-3 w-3" /> : i + 1}
                      </div>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <div className={`w-4 h-0.5 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* External links + enrichment signals */}
              <div className="flex flex-wrap items-center gap-2">
                {links.github && (
                  <a href={links.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-muted">
                    <Github className="h-3 w-3" /> GitHub
                    {enrichment?.github && (
                      <span className="text-muted-foreground ml-1">· {enrichment.github.repositories.length} repos · {enrichment.github.totalStars}★</span>
                    )}
                  </a>
                )}
                {links.linkedin && (
                  <a href={links.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-muted">
                    <Linkedin className="h-3 w-3" /> LinkedIn
                    {enrichment?.linkedin?.headline && (
                      <span className="text-muted-foreground ml-1 truncate max-w-[200px]">· {enrichment.linkedin.headline}</span>
                    )}
                  </a>
                )}
                {enrichment?.github?.topLanguages && enrichment.github.topLanguages.length > 0 && (
                  <div className="flex gap-1">
                    {enrichment.github.topLanguages.slice(0, 4).map((l) => (
                      <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0">{l}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Scoring basis — compact inline */}
              {matchResult?.scoringBasis && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-muted-foreground">Sources:</span>
                  {matchResult.scoringBasis.dataSources.map((src, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 text-muted-foreground">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />{src}
                    </span>
                  ))}
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    matchResult.scoringBasis.confidence === 'high' ? 'text-emerald-600 border-emerald-300' :
                    matchResult.scoringBasis.confidence === 'medium' ? 'text-amber-600 border-amber-300' :
                    'text-red-600 border-red-300'
                  }`}>
                    {matchResult.scoringBasis.confidence} confidence
                  </Badge>
                </div>
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

        {/* Processing state — animated */}
        {candidate.status !== 'completed' && candidate.status !== 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            {/* Animated gradient shimmer background */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />

            <div className="relative p-5 space-y-4">
              {/* Header with animated icon */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary"
                  />
                  <Sparkles className="absolute inset-0 m-auto h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {candidate.status === 'uploaded' && 'Preparing to analyze CV...'}
                    {candidate.status === 'parsed' && 'CV parsed — preparing enrichment...'}
                    {candidate.status === 'enriching' && 'Enriching profile with online data...'}
                    {candidate.status === 'enriched' && 'Profile enriched — preparing scoring...'}
                    {candidate.status === 'scoring' && 'AI is scoring the candidate...'}
                  </p>
                  <p className="text-xs text-muted-foreground">This usually takes 15-30 seconds</p>
                </div>
              </div>

              {/* Step progress with animations */}
              <div className="relative">
                {/* Background line — spans full width at icon center height */}
                <div className="absolute top-4 left-0 right-0 flex px-[calc(10%-4px)]">
                  {PIPELINE_STEPS.slice(0, -1).map((step, i) => {
                    const isCompleted = currentStepIndex > i
                    const isCurrent = currentStepIndex === i
                    return (
                      <div key={step.key} className="flex-1 h-0.5 bg-muted rounded-full overflow-hidden mx-1">
                        <motion.div
                          initial={{ width: '0%' }}
                          animate={{ width: isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    )
                  })}
                </div>
                {/* Icons + labels */}
                <div className="relative z-10 flex">
                  {PIPELINE_STEPS.map((step, i) => {
                    const isCompleted = currentStepIndex > i
                    const isCurrent = currentStepIndex === i
                    const StepIcon = step.icon
                    return (
                      <div key={step.key} className="flex-1 flex flex-col items-center">
                        <motion.div
                          initial={false}
                          animate={{
                            scale: isCurrent ? [1, 1.15, 1] : 1,
                            backgroundColor: isCompleted ? 'var(--color-primary)' : isCurrent ? 'var(--color-primary)' : 'var(--color-muted)',
                          }}
                          transition={isCurrent ? { scale: { duration: 1.5, repeat: Infinity } } : {}}
                          className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                            isCompleted || isCurrent ? 'text-primary-foreground' : 'text-muted-foreground/40'
                          }`}
                        >
                          {isCompleted ? (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <CheckCircle className="h-4 w-4" />
                            </motion.div>
                          ) : isCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <StepIcon className="h-3.5 w-3.5" />
                          )}
                        </motion.div>
                        <span className={`mt-1.5 text-[10px] font-medium ${
                          isCompleted ? 'text-primary' : isCurrent ? 'text-foreground' : 'text-muted-foreground/40'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Progress logs — animated */}
              {candidate.progressLogs && candidate.progressLogs.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-3 max-h-32 overflow-y-auto space-y-1">
                  <AnimatePresence>
                    {candidate.progressLogs.map((log, i) => (
                      <motion.p
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="text-xs text-muted-foreground font-mono"
                      >
                        <span className="text-primary mr-1.5">›</span>{log}
                      </motion.p>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <Tabs defaultValue="score">
          <TabsList>
            <TabsTrigger value="score" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Match
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileCode className="h-3.5 w-3.5" /> Documents
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Pipeline
            </TabsTrigger>
            {candidate.surveyAnswers && candidate.surveyAnswers.length > 0 && (
              <TabsTrigger value="responses" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Responses
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="score" className="space-y-4">
            {matchResult ? (
              <>
                {/* Skill Match + Strengths/Gaps — compact 2-column layout */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Skill Match Checklist */}
                  {matchResult.skillScores && matchResult.skillScores.length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Skill Match</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {matchResult.skillScores.map((skill, i) => (
                            <div key={i} className="flex items-center gap-2 py-1">
                              <div className="shrink-0">
                                {skill.level === 'yes' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                                {skill.level === 'partial' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                {skill.level === 'no' && <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-red-400 text-red-400 text-[9px] font-bold">✕</span>}
                              </div>
                              <span className="text-sm font-medium">{skill.name}</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="text-xs text-muted-foreground truncate ml-auto max-w-[45%] cursor-default text-left">
                                    {skill.evidence}
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">
                                    {skill.evidence}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Strengths & Gaps — stacked in one card */}
                  <Card className="shadow-sm">
                    <CardContent className="py-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">Strengths</p>
                        <ul className="space-y-1 text-sm">
                          {matchResult.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t pt-3">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1.5">Gaps</p>
                        <ul className="space-y-1 text-sm">
                          {matchResult.gaps.map((g, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Explanation — collapsible */}
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium select-none rounded-lg border bg-card px-4 py-3 shadow-sm hover:bg-muted/50">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    AI Explanation
                    <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
                    <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">Hide</span>
                  </summary>
                  <div className="mt-2 rounded-lg border bg-card p-4 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{matchResult.explanation}</p>
                  </div>
                </details>

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

          <TabsContent value="profile" className="space-y-4">
            {/* Re-enrich controls */}
            {(links.github || links.linkedin) && (candidate.status === 'completed' || candidate.status === 'error') && (
              <div className="flex items-center gap-3">
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted transition-colors">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {enrichment?.github || enrichment?.linkedin ? 'Re-fetch' : 'Fetch'}{' '}
                    {[links.github && 'GitHub', links.linkedin && 'LinkedIn'].filter(Boolean).join(' + ')}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Fetch online profile data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will fetch data from{' '}
                        {[links.github && 'GitHub', links.linkedin && 'LinkedIn'].filter(Boolean).join(' and ')}{' '}
                        and re-score the candidate.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReEnrich}>Start</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Parsed CV — Summary + Skills + Experience + Education inline */}
            {candidate.parsedCV && (
              <>
                {candidate.parsedCV.summary && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{candidate.parsedCV.summary}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {candidate.parsedCV.skills.length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Skills</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.parsedCV.skills.map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {candidate.parsedCV.education.length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Education</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {candidate.parsedCV.education.map((edu, i) => (
                          <div key={i}>
                            <p className="text-sm font-medium">{edu.degree}</p>
                            <p className="text-xs text-muted-foreground">{edu.school} · {edu.year}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {candidate.parsedCV.experience.length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Experience</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {candidate.parsedCV.experience.map((exp, i) => (
                        <div key={i} className="relative border-l-2 border-primary/20 pl-3">
                          <div className="absolute -left-[4px] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          <p className="text-sm font-medium">{exp.title}</p>
                          <p className="text-xs text-muted-foreground">{exp.company} · {exp.duration}</p>
                          {exp.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{exp.description}</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* GitHub */}
            {enrichment?.github && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Github className="h-4 w-4" /> @{enrichment.github.username}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {enrichment.github.bio && <p className="text-sm">{enrichment.github.bio}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {enrichment.github.topLanguages.length > 0 && (
                      <div className="flex gap-1">
                        {enrichment.github.topLanguages.map((l) => (
                          <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                        ))}
                      </div>
                    )}
                    <span>Stars: <strong className="text-foreground">{enrichment.github.totalStars}</strong></span>
                    {enrichment.github.totalContributions != null && (
                      <span>Contributions: <strong className="text-foreground">{enrichment.github.totalContributions}</strong></span>
                    )}
                  </div>
                  <GitHubAnalysis raw={enrichment.github.raw} username={enrichment.github.username} />
                  {enrichment.github.repositories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Repositories</p>
                      {enrichment.github.repositories.map((r) => (
                        <div key={r.name} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{r.name}</span>
                            {r.language && <Badge variant="outline" className="text-xs">{r.language}</Badge>}
                            <span className="text-xs text-muted-foreground">{r.stars}★</span>
                          </div>
                          {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* LinkedIn */}
            {enrichment?.linkedin && (enrichment.linkedin.headline || enrichment.linkedin.summary || enrichment.linkedin.experience.length > 0 || enrichment.linkedin.skills.length > 0) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {enrichment.linkedin.headline && <p className="text-sm font-medium">{enrichment.linkedin.headline}</p>}
                  {enrichment.linkedin.summary && <p className="text-xs leading-relaxed text-muted-foreground">{enrichment.linkedin.summary}</p>}
                  {enrichment.linkedin.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {enrichment.linkedin.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  )}
                  {enrichment.linkedin.experience.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {enrichment.linkedin.experience.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
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

          <TabsContent value="documents" className="space-y-4">
            <div className="grid gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Raw CV Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed max-h-[400px] overflow-y-auto">
                    {candidate.cvText || 'No text extracted yet.'}
                  </pre>
                </CardContent>
              </Card>
              <PdfViewer jobId={jobId!} candidateId={candidateId!} />
            </div>
          </TabsContent>

          <TabsContent value="pipeline">
            <PipelineStageSection
              jobId={jobId!}
              candidateId={candidateId!}
              candidate={candidate}
              onUpdate={setCandidate}
            />
          </TabsContent>

          {candidate.surveyAnswers && candidate.surveyAnswers.length > 0 && (
            <TabsContent value="responses">
              <ApplicationResponses answers={candidate.surveyAnswers} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageTransition>
  )
}

function ApplicationResponses({ answers }: { answers: SurveyAnswer[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Application Responses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {answers.map((a) => (
          <div key={a.questionId}>
            <p className="text-sm font-semibold">{a.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {Array.isArray(a.value) ? a.value.join(', ') : a.value || '—'}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
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

  // Build company experience entries for companyIntel (no URLs — these are company names, not links)
  const companyEntries = (candidate.parsedCV?.experience || []).map((exp) => ({
    url: '',
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
      label: 'Experience Verification',
      types: [
        {
          key: 'companyIntel',
          label: 'Verify Companies',
          desc: 'Research companies listed in candidate experience',
          available: (candidate.parsedCV?.experience?.length || 0) > 0,
        },
      ],
    },
  ]

  // Per-company URL inputs and running state
  const [companyUrls, setCompanyUrls] = useState<Record<string, string>>({})
  const [companyRunning, setCompanyRunning] = useState<Record<string, boolean>>({})
  const [companyCompleted, setCompanyCompleted] = useState<Record<string, boolean>>({})

  // Detect completed companyIntel from progress changes
  useEffect(() => {
    if (progress.companyIntel?.status === 'completed') {
      // Mark all currently-running companies as completed
      setCompanyRunning({})
      setCompanyCompleted((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(prev)) {
          if (prev[key] !== undefined) next[key] = true
        }
        return next
      })
    }
  }, [progress.companyIntel?.status])

  const runCompany = async (companyName: string) => {
    const url = companyUrls[companyName]?.trim() || undefined
    try {
      setCompanyRunning((prev) => ({ ...prev, [companyName]: true }))
      await candidatesApi.extendedEnrich(jobId, candidateId, ['companyIntel'], {
        companyName,
        companyUrl: url,
      })
      setLiveProgress((prev) => ({ ...prev, companyIntel: { status: 'queued', logs: [] } }))
      toast.success(`Company research started: ${companyName}`)
    } catch {
      setCompanyRunning((prev) => ({ ...prev, [companyName]: false }))
      toast.error(`Failed to start research: ${companyName}`)
    }
  }

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
                {ci.founded && (
                  <span className="text-xs text-muted-foreground">Est. {ci.founded}</span>
                )}
                {ci.headquarters && (
                  <span className="text-xs text-muted-foreground">{ci.headquarters}</span>
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

                  {/* Sub-items with Run buttons */}
                  {typeUrls.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {typeUrls.map((u, idx) => {
                        // Extract company name from label for companyIntel entries
                        const companyName =
                          t.key === 'companyIntel'
                            ? (candidate.parsedCV?.experience?.[idx]?.company || u.label.split(' (')[0])
                            : ''
                        const isCompanyRunning = t.key === 'companyIntel' && companyRunning[companyName]
                        const isCompanyDone = t.key === 'companyIntel' && companyCompleted[companyName]

                        return (
                          <div
                            key={u.url || `${t.key}-${idx}`}
                            className={`flex items-center justify-between gap-2 pl-2 py-0.5 ${t.key === 'companyIntel' ? 'flex-wrap' : ''}`}
                          >
                            {u.url ? (
                              <a
                                href={u.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate"
                              >
                                {u.label}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground truncate">
                                {u.label}
                              </span>
                            )}
                            {t.key === 'companyIntel' ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Input
                                  placeholder="Company URL (optional)"
                                  className="h-6 w-44 text-xs px-2"
                                  value={companyUrls[companyName] || ''}
                                  onChange={(e) =>
                                    setCompanyUrls((prev) => ({
                                      ...prev,
                                      [companyName]: e.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs shrink-0"
                                  onClick={() => runCompany(companyName)}
                                  disabled={isCompanyRunning || isActive}
                                >
                                  {isCompanyRunning
                                    ? 'Running...'
                                    : isCompanyDone || hasResult
                                      ? 'Re-run'
                                      : 'Run'}
                                </Button>
                              </div>
                            ) : (
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
                            )}
                          </div>
                        )
                      })}
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

const PIPELINE_STAGE_OPTIONS: { key: PipelineStage; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { key: 'screening', label: 'Screening', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { key: 'interview', label: 'Interview', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { key: 'offer', label: 'Offer', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { key: 'hired', label: 'Hired', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
]

function PipelineStageSection({
  jobId,
  candidateId,
  candidate,
  onUpdate,
}: {
  jobId: string
  candidateId: string
  candidate: Candidate
  onUpdate: (c: Candidate | null) => void
}) {
  const [changing, setChanging] = useState(false)

  const handleStageChange = async (newStage: PipelineStage) => {
    if (newStage === candidate.pipelineStage) return
    setChanging(true)
    try {
      const updated = await candidatesApi.updatePipelineStage(jobId, candidateId, newStage)
      onUpdate(updated)
      toast.success(`Moved to ${PIPELINE_STAGE_OPTIONS.find((s) => s.key === newStage)?.label}`)
    } catch {
      toast.error('Failed to update pipeline stage')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Pipeline Stage — visual tracker */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Pipeline Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual stage tracker */}
          <div className="space-y-1">
            {PIPELINE_STAGE_OPTIONS.map((stage, i) => {
              const isCurrent = candidate.pipelineStage === stage.key
              const currentIdx = PIPELINE_STAGE_OPTIONS.findIndex((s) => s.key === candidate.pipelineStage)
              const isPast = stage.key !== 'rejected' && i < currentIdx && candidate.pipelineStage !== 'rejected'
              const isRejected = stage.key === 'rejected' && candidate.pipelineStage === 'rejected'

              return (
                <motion.button
                  key={stage.key}
                  onClick={() => !changing && handleStageChange(stage.key)}
                  disabled={changing}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all cursor-pointer border ${
                    isCurrent || isRejected
                      ? `${stage.color} border-current/20 font-semibold ring-1 ring-current/10`
                      : isPast
                        ? 'bg-primary/5 border-primary/10 text-primary/70'
                        : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                    isCurrent || isRejected
                      ? stage.color
                      : isPast
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground/50'
                  }`}>
                    {isPast ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span>{stage.label}</span>
                  {(isCurrent || isRejected) && (
                    <motion.div
                      layoutId="stage-indicator"
                      className="ml-auto h-2 w-2 rounded-full bg-current"
                    />
                  )}
                  {changing && isCurrent && (
                    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
                  )}
                </motion.button>
              )
            })}
          </div>

          {/* Pipeline history */}
          {candidate.pipelineHistory && candidate.pipelineHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                History
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {[...candidate.pipelineHistory].reverse().map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="font-medium capitalize">{entry.from}</span>
                    <span className="text-primary">&rarr;</span>
                    <span className="font-medium capitalize">{entry.to}</span>
                    <span className="ml-auto text-[10px]">
                      {new Date(entry.changedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <CandidateNotes
        jobId={jobId}
        candidateId={candidateId}
        notes={candidate.notes || []}
        onNotesUpdate={(notes) =>
          onUpdate(candidate ? { ...candidate, notes } : null)
        }
      />
    </div>
  )
}
