import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonCard } from '@/components/ui/skeleton'
import { Plus, Briefcase, CheckCircle, XCircle, X, Users, LinkIcon, Check } from 'lucide-react'
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from '@/components/ui/motion'
import ReactMarkdown from 'react-markdown'
import { jobsApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reqInput, setReqInput] = useState('')
  const [screeningCriteria, setScreeningCriteria] = useState('')
  const [previewMode, setPreviewMode] = useState<string>('write')
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null)

  useEffect(() => {
    jobsApi.list().then((data) => {
      setJobs(data)
      setLoading(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
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
    setSubmitting(false)
  }

  const handleToggle = async (e: React.MouseEvent, job: Job) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = await jobsApi.toggleActive(job.id, !job.isActive)
    setJobs(jobs.map((j) => (j.id === updated.id ? { ...j, isActive: updated.isActive } : j)))
  }

  const handleCopyLink = (e: React.MouseEvent, jobId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const link = `${window.location.origin}/careers/${jobId}/apply`
    navigator.clipboard.writeText(link)
    setCopiedJobId(jobId)
    setTimeout(() => setCopiedJobId(null), 2000)
  }

  const activeCount = jobs.filter((j) => j.isActive).length

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

        {/* Stats */}
        {!loading && jobs.length > 0 && (
          <FadeIn>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" />
                  Total Jobs
                </div>
                <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Active
                </div>
                <p className="mt-1 text-2xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-card">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  Inactive
                </div>
                <p className="mt-1 text-2xl font-semibold">{jobs.length - activeCount}</p>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Create form */}
        {showForm && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Create Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Senior Backend Engineer (Node.js)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Job Description (Markdown supported)</Label>
                  <Tabs value={previewMode} onValueChange={setPreviewMode}>
                    <TabsList>
                      <TabsTrigger value="write">Write</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="write">
                      <Textarea
                        placeholder={
                          "## About the role\n\nDescribe responsibilities, team, tech stack...\n\n## What you'll do\n\n- Build microservices\n- Design APIs\n- ..."
                        }
                        rows={12}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="font-mono text-sm"
                        required
                      />
                    </TabsContent>
                    <TabsContent value="preview">
                      <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border p-4">
                        {description ? (
                          <ReactMarkdown>{description}</ReactMarkdown>
                        ) : (
                          <p className="text-muted-foreground">Nothing to preview</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Requirements (one per line)</Label>
                  <Textarea
                    id="requirements"
                    placeholder="4+ years Node.js/TypeScript&#10;Experience with PostgreSQL&#10;Docker & Kubernetes"
                    rows={5}
                    value={reqInput}
                    onChange={(e) => setReqInput(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="screening">Screening Criteria</Label>
                    <Badge variant="outline" className="text-xs">
                      Internal only
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Private notes for AI scoring. Candidates won't see this.
                  </p>
                  <Textarea
                    id="screening"
                    placeholder="Prefer candidates with:&#10;- Open source contributions&#10;- Experience in fintech or payments&#10;&#10;Red flags:&#10;- Job hopping (less than 1 year per role)"
                    rows={5}
                    value={screeningCriteria}
                    onChange={(e) => setScreeningCriteria(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={submitting} className="h-10">
                  {submitting ? 'Creating...' : 'Create Job'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Job list */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20">
            <Briefcase className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-5 text-lg font-semibold">No jobs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first job description to start recruiting
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-6 gap-2">
              <Plus className="h-4 w-4" /> Create First Job
            </Button>
          </div>
        ) : (
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
        )}
      </div>
    </PageTransition>
  )
}
