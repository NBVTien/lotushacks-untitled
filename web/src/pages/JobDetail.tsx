import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge, RecommendationBadge } from '@/components/ui/status-badge'
import { JobDetailSkeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Upload,
  Pencil,
  Users,
  FileText,
  LinkIcon,
  Check,
  X,
  GitCompareArrows,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageTransition } from '@/components/ui/motion'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { jobsApi, candidatesApi } from '@/lib/api'
import { PipelineBoard } from '@/components/PipelineBoard'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { Job, Candidate, SurveyQuestion, SurveyQuestionType } from '@lotushack/shared'

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  rating: 'Rating (1–5)',
  select: 'Single Choice',
  multiselect: 'Multiple Choice',
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-foreground'
  if (score >= 60) return 'text-foreground'
  if (score >= 40) return 'text-muted-foreground'
  return 'text-muted-foreground'
}

function getScoreDotColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [uploading, setUploading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    requirements: '',
    screeningCriteria: '',
    surveyQuestions: [] as SurveyQuestion[],
  })
  const [newQuestion, setNewQuestion] = useState<{
    label: string
    type: SurveyQuestionType
    required: boolean
    options: string
  }>({ label: '', type: 'text', required: false, options: '' })
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidateView, setCandidateView] = useState<'table' | 'pipeline'>('table')

  const loadData = useCallback(async () => {
    if (!jobId || notFound) return
    setError(null)
    try {
      const [jobData, candidatesData] = await Promise.all([
        jobsApi.get(jobId),
        candidatesApi.list(jobId),
      ])
      setJob(jobData)
      setCandidates(candidatesData)
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setNotFound(true)
      } else {
        setError('Failed to load job details. Please try again.')
      }
    }
  }, [jobId, notFound])

  const hasProcessing = candidates.some((c) => !['completed', 'error'].includes(c.status))

  useEffect(() => {
    loadData()
    if (!hasProcessing && candidates.length > 0) return
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData, hasProcessing, candidates.length])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !jobId) return
    setUploading(true)
    try {
      await candidatesApi.upload(jobId, file)
      await loadData()
      toast.success('CV uploaded successfully')
    } catch {
      toast.error('Failed to upload CV')
    }
    setUploading(false)
    e.target.value = ''
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
        </Link>
        <p className="text-muted-foreground">Job not found. It may have been deleted.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
        </Link>
        <ErrorState message={error} onRetry={loadData} />
      </div>
    )
  }

  if (!job) {
    return <JobDetailSkeleton />
  }

  // Pipeline stats
  const totalCandidates = candidates.length
  const completedCount = candidates.filter((c) => c.status === 'completed').length
  const processingCount = candidates.filter(
    (c) => !['completed', 'error'].includes(c.status)
  ).length
  const errorCount = candidates.filter((c) => c.status === 'error').length

  return (
    <PageTransition>
      <div className="space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
        </Link>

        <PageHeader title={job.title}>
          {editing ? (
            <>
              <Button type="submit" form="edit-job-form" disabled={saving} size="sm" className="gap-2">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditForm({
                    title: job.title,
                    description: job.description,
                    requirements: job.requirements.join('\n'),
                    screeningCriteria: job.screeningCriteria || '',
                    surveyQuestions: job.surveyQuestions ?? [],
                  })
                  setAddingQuestion(false)
                  setNewQuestion({ label: '', type: 'text', required: false, options: '' })
                  setTimeout(() => setEditing(true), 0)
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={uploading}
                onClick={() => document.getElementById('cv-upload')?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Upload CV'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="outline" size="sm" className="px-2" type="button">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      const link = `${window.location.origin}/careers/${jobId}/apply`
                      navigator.clipboard.writeText(link)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? (
                      <><Check className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600">Copied!</span></>
                    ) : (
                      <><LinkIcon className="h-4 w-4" /> Copy Apply Link</>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <input
            id="cv-upload"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </PageHeader>

        {/* Pipeline stats */}
        {candidates.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <p className="text-xl font-semibold">{totalCandidates}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <p className="text-xl font-semibold">{processingCount}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Processing</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <p className="text-xl font-semibold">{completedCount}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
            </div>
            {errorCount > 0 && (
              <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
                <p className="text-xl font-semibold">{errorCount}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Errors</p>
              </div>
            )}
          </div>
        )}

        {editing ? (
          /* Edit form — tabbed to mirror the read-only view */
          <form
            id="edit-job-form"
            onSubmit={async (e) => {
              e.preventDefault()
              setSaving(true)
              try {
                const reqs = editForm.requirements
                  .split('\n')
                  .map((r) => r.trim())
                  .filter(Boolean)
                const updated = await jobsApi.update(job.id, {
                  title: editForm.title,
                  description: editForm.description,
                  requirements: reqs,
                  screeningCriteria: editForm.screeningCriteria.trim() || undefined,
                  surveyQuestions: editForm.surveyQuestions,
                })
                setJob(updated)
                setEditing(false)
                toast.success('Job updated successfully')
              } catch {
                toast.error('Failed to update job')
              }
              setSaving(false)
            }}
          >
            <Tabs defaultValue="jd">
              <TabsList>
                <TabsTrigger value="jd" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Description
                </TabsTrigger>
                <TabsTrigger value="screening">Screening</TabsTrigger>
                <TabsTrigger value="survey">Survey</TabsTrigger>
              </TabsList>

              {/* Description tab */}
              <TabsContent value="jd">
                <Card className="shadow-sm">
                  <CardContent className="space-y-6 py-6">
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <MarkdownEditor
                        value={editForm.description}
                        onChange={(val) => setEditForm({ ...editForm, description: val })}
                        placeholder="Describe the role..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Requirements</Label>
                      <p className="text-xs text-muted-foreground">One per line</p>
                      <Textarea
                        value={editForm.requirements}
                        onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })}
                        rows={4}
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Screening tab */}
              <TabsContent value="screening">
                <Card className="shadow-sm">
                  <CardContent className="py-6 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Label>Screening Criteria</Label>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Internal
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Private notes used by AI to score candidates — not visible to applicants.
                    </p>
                    <Textarea
                      value={editForm.screeningCriteria}
                      onChange={(e) =>
                        setEditForm({ ...editForm, screeningCriteria: e.target.value })
                      }
                      rows={6}
                      className="text-sm"
                      placeholder="Private notes for AI scoring..."
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Survey tab */}
              <TabsContent value="survey">
                <Card className="shadow-sm">
                  <CardContent className="py-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Application Questions</p>
                        <p className="text-xs text-muted-foreground">
                          Candidates answer these when they apply.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingQuestion((v) => !v)}
                      >
                        {addingQuestion ? 'Cancel' : '+ Add Question'}
                      </Button>
                    </div>

                    {editForm.surveyQuestions.length > 0 && (
                      <div className="space-y-2">
                        {editForm.surveyQuestions.map((q) => (
                          <div
                            key={q.id}
                            className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                          >
                            <span className="flex-1 font-medium truncate">{q.label}</span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {QUESTION_TYPE_LABELS[q.type]}
                            </Badge>
                            {q.required && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                Required
                              </Badge>
                            )}
                            <button
                              type="button"
                              className="ml-1 rounded p-0.5 hover:bg-muted transition-colors shrink-0"
                              onClick={() =>
                                setEditForm((f) => ({
                                  ...f,
                                  surveyQuestions: f.surveyQuestions.filter((sq) => sq.id !== q.id),
                                }))
                              }
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {editForm.surveyQuestions.length === 0 && !addingQuestion && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No questions yet. Add one to collect info from applicants.
                      </p>
                    )}

                    {addingQuestion && (
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Question Label</Label>
                          <Input
                            value={newQuestion.label}
                            onChange={(e) =>
                              setNewQuestion((q) => ({ ...q, label: e.target.value }))
                            }
                            placeholder="e.g. How many years of experience do you have?"
                            className="text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={newQuestion.type}
                              onValueChange={(v) =>
                                setNewQuestion((q) => ({ ...q, type: v as SurveyQuestionType }))
                              }
                            >
                              <SelectTrigger className="h-9 w-full text-sm">
                                <span className="flex-1 text-left">
                                  {QUESTION_TYPE_LABELS[newQuestion.type]}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Short Text</SelectItem>
                                <SelectItem value="textarea">Long Text</SelectItem>
                                <SelectItem value="rating">Rating (1–5)</SelectItem>
                                <SelectItem value="select">Single Choice</SelectItem>
                                <SelectItem value="multiselect">Multiple Choice</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs invisible">Required</span>
                            <label className="flex h-9 items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newQuestion.required}
                                onChange={(e) =>
                                  setNewQuestion((q) => ({ ...q, required: e.target.checked }))
                                }
                                className="h-4 w-4 rounded border-muted-foreground/30"
                              />
                              Required
                            </label>
                          </div>
                        </div>
                        {(newQuestion.type === 'select' || newQuestion.type === 'multiselect') && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Options (comma-separated)</Label>
                            <Input
                              value={newQuestion.options}
                              onChange={(e) =>
                                setNewQuestion((q) => ({ ...q, options: e.target.value }))
                              }
                              placeholder="Option A, Option B, Option C"
                              className="text-sm"
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={!newQuestion.label.trim()}
                          onClick={() => {
                            const options =
                              newQuestion.type === 'select' || newQuestion.type === 'multiselect'
                                ? newQuestion.options
                                    .split(',')
                                    .map((o) => o.trim())
                                    .filter(Boolean)
                                : undefined
                            const q: SurveyQuestion = {
                              id: crypto.randomUUID(),
                              label: newQuestion.label.trim(),
                              type: newQuestion.type,
                              required: newQuestion.required,
                              order: editForm.surveyQuestions.length,
                              ...(options ? { options } : {}),
                            }
                            setEditForm((f) => ({
                              ...f,
                              surveyQuestions: [...f.surveyQuestions, q],
                            }))
                            setNewQuestion({ label: '', type: 'text', required: false, options: '' })
                            setAddingQuestion(false)
                          }}
                        >
                          Add Question
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </form>
        ) : (
          /* Read-only view */
          <Tabs defaultValue="jd">
            <TabsList>
              <TabsTrigger value="jd" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Description
              </TabsTrigger>
              <TabsTrigger value="candidates" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Candidates ({candidates.length})
              </TabsTrigger>
              {job.screeningCriteria && <TabsTrigger value="screening">Screening</TabsTrigger>}
              <TabsTrigger value="survey">Survey</TabsTrigger>
            </TabsList>

            <TabsContent value="jd" className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="py-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{job.description}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>

              {job.requirements.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Requirements</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.requirements.map((req, i) => (
                      <Badge key={i} variant="secondary">
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="candidates" className="space-y-3">
              {candidates.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No candidates yet"
                  description="Upload a CV to start evaluating candidates for this position"
                  action={{
                    label: 'Upload CV',
                    onClick: () => document.getElementById('cv-upload')?.click(),
                  }}
                />
              ) : (
                <>
                  {/* View toggle */}
                  <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
                    <button
                      onClick={() => setCandidateView('table')}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        candidateView === 'table'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Table
                    </button>
                    <button
                      onClick={() => setCandidateView('pipeline')}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        candidateView === 'pipeline'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Pipeline
                    </button>
                  </div>

                  {candidateView === 'pipeline' ? (
                    <PipelineBoard jobId={jobId!} />
                  ) : (
                  <div className="overflow-hidden rounded-xl border shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="w-10 px-3 py-3 text-center text-xs font-medium text-muted-foreground">
                            <span className="sr-only">Select</span>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Candidate
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                            Score
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                            Recommendation
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c) => {
                          const isSelected = selectedIds.has(c.id)
                          const canSelect = isSelected || selectedIds.size < 3
                          return (
                            <tr
                              key={c.id}
                              className={`group border-b last:border-0 transition-colors hover:bg-muted/40 ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!canSelect && !isSelected}
                                  title={
                                    !canSelect && !isSelected
                                      ? 'Maximum 3 candidates can be compared'
                                      : 'Select for comparison'
                                  }
                                  onChange={() => {
                                    setSelectedIds((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(c.id)) {
                                        next.delete(c.id)
                                      } else if (next.size < 3) {
                                        next.add(c.id)
                                      }
                                      return next
                                    })
                                  }}
                                  className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Link to={`/jobs/${jobId}/candidates/${c.id}`} className="block">
                                  <p className="font-medium text-sm group-hover:text-primary transition-colors">
                                    {c.name}
                                  </p>
                                  {c.email && (
                                    <p className="text-xs text-muted-foreground">{c.email}</p>
                                  )}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={c.status} />
                              </td>
                              <td className="px-4 py-3 text-right">
                                {c.matchResult && (
                                  <span
                                    className={`inline-flex items-center gap-1.5 text-sm font-semibold ${getScoreTextColor(c.matchResult.overallScore)}`}
                                  >
                                    {c.matchResult.overallScore}
                                    <span
                                      className={`inline-block h-2 w-2 rounded-full ${getScoreDotColor(c.matchResult.overallScore)}`}
                                    />
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {c.matchResult && (
                                  <RecommendationBadge
                                    recommendation={c.matchResult.recommendation}
                                  />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {/* Floating compare button */}
                  {selectedIds.size >= 2 && (
                    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                      <Button
                        size="lg"
                        className="gap-2 shadow-lg shadow-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-300"
                        onClick={() => {
                          const ids = Array.from(selectedIds).join(',')
                          navigate(`/jobs/${jobId}/compare?ids=${ids}`)
                        }}
                      >
                        <GitCompareArrows className="h-4 w-4" />
                        Compare ({selectedIds.size})
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {job.screeningCriteria && (
              <TabsContent value="screening">
                <Card className="shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Screening Criteria</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        Internal only
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These criteria are used by AI to score candidates but are not visible to
                      applicants.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm">{job.screeningCriteria}</div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="survey">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Application Questions</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Candidates answer these when they apply for this role.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {job.surveyQuestions?.length > 0 ? (
                    job.surveyQuestions.map((q, i) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                        <span className="flex-1 font-medium">{q.label}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {QUESTION_TYPE_LABELS[q.type]}
                        </Badge>
                        {q.required && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Required
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No questions configured. Edit the job to add application questions.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PageTransition>
  )
}
