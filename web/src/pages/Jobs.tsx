import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { JobCardSkeleton } from '@/components/ui/skeleton'
import { Plus, Briefcase, X, Users, LinkIcon, Check, LayoutGrid, List } from 'lucide-react'
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { toast } from 'sonner'
import { jobsApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'Jobs — TalentLens Recruiter' }, [])
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reqInput, setReqInput] = useState('')
  const [screeningCriteria, setScreeningCriteria] = useState('')
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'card' | 'table'>('card')

  type JobField = 'title' | 'description' | 'requirements'
  const [formErrors, setFormErrors] = useState<Partial<Record<JobField, string>>>({})
  const [formTouched, setFormTouched] = useState<Partial<Record<JobField, boolean>>>({})

  const validateJobField = (field: JobField): string | undefined => {
    if (field === 'title' && !title.trim()) return 'Job title is required'
    if (field === 'description') {
      if (!description.trim()) return 'Description is required'
      if (description.trim().length < 20) return 'Description must be at least 20 characters'
    }
    if (field === 'requirements') {
      const reqs = reqInput.split('\n').map((r) => r.trim()).filter(Boolean)
      if (reqs.length === 0) return 'At least one requirement is needed'
    }
    return undefined
  }

  const handleJobBlur = (field: JobField) => {
    setFormTouched((t) => ({ ...t, [field]: true }))
    setFormErrors((prev) => ({ ...prev, [field]: validateJobField(field) }))
  }

  const validateJobAll = () => {
    const fields: JobField[] = ['title', 'description', 'requirements']
    const errs: Partial<Record<JobField, string>> = {}
    const t: Partial<Record<JobField, boolean>> = {}
    for (const f of fields) {
      errs[f] = validateJobField(f)
      t[f] = true
    }
    setFormErrors(errs)
    setFormTouched(t)
    return !Object.values(errs).some(Boolean)
  }

  const jobFormHasErrors =
    !title.trim() ||
    !description.trim() ||
    description.trim().length < 20 ||
    reqInput.split('\n').map((r) => r.trim()).filter(Boolean).length === 0

  const loadJobs = () => {
    setLoading(true)
    setError(null)
    jobsApi
      .list()
      .then((data) => {
        setJobs(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load jobs. Please check your connection and try again.')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateJobAll()) return
    setSubmitting(true)
    try {
      const reqs = reqInput
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
      const job = await jobsApi.create({
        title,
        description,
        requirements: reqs,
        screeningCriteria: screeningCriteria.trim() || undefined,
      })
      setJobs([job, ...jobs])
      setTitle('')
      setDescription('')
      setReqInput('')
      setScreeningCriteria('')
      setShowForm(false)
      setFormErrors({})
      setFormTouched({})
      toast.success('Job created successfully')
    } catch {
      toast.error('Failed to create job')
    }
    setSubmitting(false)
  }

  const handleToggle = async (e: React.MouseEvent, job: Job) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const updated = await jobsApi.toggleActive(job.id, !job.isActive)
      setJobs(jobs.map((j) => (j.id === updated.id ? { ...j, isActive: updated.isActive } : j)))
      toast.success(`Job ${updated.isActive ? 'activated' : 'deactivated'}`)
    } catch {
      toast.error('Failed to update job status')
    }
  }

  const handleCopyLink = (e: React.MouseEvent, jobId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const link = `${window.location.origin}/careers/${jobId}/apply`
    navigator.clipboard.writeText(link)
    setCopiedJobId(jobId)
    setTimeout(() => setCopiedJobId(null), 2000)
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader title="Jobs" description="Manage your job descriptions and candidates">
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? (
              <>
                <X className="h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> New Job
              </>
            )}
          </Button>
        </PageHeader>

        {/* Create form */}
        {showForm && (
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">New Job</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Senior Backend Engineer (Node.js)"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: undefined }))
                    }}
                    onBlur={() => handleJobBlur('title')}
                    className={`h-11 ${formTouched.title && formErrors.title ? 'border-destructive' : ''}`}
                  />
                  {formTouched.title && formErrors.title && (
                    <p className="text-sm text-destructive mt-1">{formErrors.title}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <MarkdownEditor
                    value={description}
                    onChange={(val) => {
                      setDescription(val)
                      if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: undefined }))
                    }}
                    placeholder="Describe the role, responsibilities, tech stack..."
                  />
                  {formTouched.description && formErrors.description && (
                    <p className="text-sm text-destructive mt-1">{formErrors.description}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="requirements">Requirements</Label>
                  <p className="text-xs text-muted-foreground">One per line</p>
                  <Textarea
                    id="requirements"
                    placeholder="4+ years Node.js/TypeScript&#10;Experience with PostgreSQL&#10;Docker & Kubernetes"
                    rows={4}
                    value={reqInput}
                    onChange={(e) => {
                      setReqInput(e.target.value)
                      if (formErrors.requirements) setFormErrors((prev) => ({ ...prev, requirements: undefined }))
                    }}
                    onBlur={() => handleJobBlur('requirements')}
                    className={`text-sm ${formTouched.requirements && formErrors.requirements ? 'border-destructive' : ''}`}
                  />
                  {formTouched.requirements && formErrors.requirements && (
                    <p className="text-sm text-destructive mt-1">{formErrors.requirements}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="screening">Screening Criteria</Label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Internal
                    </Badge>
                  </div>
                  <Textarea
                    id="screening"
                    placeholder="Private notes for AI scoring..."
                    rows={4}
                    value={screeningCriteria}
                    onChange={(e) => setScreeningCriteria(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button type="submit" disabled={submitting || jobFormHasErrors} size="sm">
                    {submitting ? 'Creating...' : 'Create Job'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Job list */}
        {error ? (
          <ErrorState message={error} onRetry={loadJobs} />
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs yet"
            description="Create your first job posting to start finding candidates"
            action={{ label: 'Create Job', onClick: () => setShowForm(true) }}
          />
        ) : (
          <div className="space-y-3">
            {/* View toggle */}
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setView('card')}
                title="Card view"
                className={`rounded-md p-1.5 transition-colors ${view === 'card' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('table')}
                title="Table view"
                className={`rounded-md p-1.5 transition-colors ${view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {view === 'card' ? (
              <StaggerContainer className="grid gap-4 md:grid-cols-2">
                {jobs.map((job) => (
                  <StaggerItem key={job.id}>
                    <Link to={`/jobs/${job.id}`}>
                      <Card
                        className={`group shadow-sm border-border/50 transition-shadow duration-200 hover:shadow-[inset_3px_0_0_0_var(--color-primary),0_4px_12px_rgba(0,0,0,0.06)] ${!job.isActive ? 'opacity-60' : ''}`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${job.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                              />
                              <CardTitle className="text-base">{job.title}</CardTitle>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => handleCopyLink(e, job.id)}
                                className="gap-1 text-muted-foreground hover:text-foreground"
                                title="Copy apply link"
                              >
                                {copiedJobId === job.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-emerald-600">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="h-3.5 w-3.5" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                variant={job.isActive ? 'outline' : 'secondary'}
                                size="xs"
                                onClick={(e) => handleToggle(e, job)}
                                className="shrink-0"
                              >
                                {job.isActive ? 'Active' : 'Inactive'}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {job.description.replace(/[#*_`\[\]]/g, '').slice(0, 150)}...
                          </p>
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {job.requirements.length} requirements
                            </span>
                            {(job as Job & { candidateCount?: number }).candidateCount != null && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {(job as Job & { candidateCount?: number }).candidateCount} candidates
                              </span>
                            )}
                            {job.screeningCriteria && (
                              <Badge variant="outline" className="text-xs">
                                Has screening criteria
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Candidates</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Requirements</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Screening</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {jobs.map((job) => {
                      const jobWithCount = job as Job & { candidateCount?: number }
                      return (
                        <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <Link
                              to={`/jobs/${job.id}`}
                              className="flex items-center gap-2 font-medium hover:underline"
                            >
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${job.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                              />
                              {job.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={job.isActive ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {job.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {jobWithCount.candidateCount
                              ? jobWithCount.candidateCount
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {job.requirements.length}
                          </td>
                          <td className="px-4 py-3">
                            {job.screeningCriteria ? (
                              <Badge variant="outline" className="text-xs">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => handleCopyLink(e, job.id)}
                                className="gap-1 text-muted-foreground hover:text-foreground"
                                title="Copy apply link"
                              >
                                {copiedJobId === job.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-emerald-600">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="h-3.5 w-3.5" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                variant={job.isActive ? 'outline' : 'secondary'}
                                size="xs"
                                onClick={(e) => handleToggle(e, job)}
                                className="shrink-0"
                              >
                                {job.isActive ? 'Active' : 'Inactive'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
