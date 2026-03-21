import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge, RecommendationBadge } from '@/components/ui/status-badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ArrowLeft, Upload, Pencil, Users, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { jobsApi, candidatesApi } from '@/lib/api'
import type { Job, Candidate } from '@lotushack/shared'

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [uploading, setUploading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', requirements: '', screeningCriteria: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!jobId || notFound) return
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
    await candidatesApi.upload(jobId, file)
    await loadData()
    setUploading(false)
    e.target.value = ''
  }

  if (notFound) {
    return (
      <div className="space-y-4 animate-fade-up">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
        </Link>
        <p className="text-muted-foreground">Job not found. It may have been deleted.</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
      </Link>

      <PageHeader title={job.title}>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setEditing(true)
            setEditForm({
              title: job.title,
              description: job.description,
              requirements: job.requirements.join('\n'),
              screeningCriteria: job.screeningCriteria || '',
            })
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          className="gap-2"
          disabled={uploading}
          onClick={() => document.getElementById('cv-upload')?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Upload CV'}
        </Button>
        <input
          id="cv-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleUpload}
        />
      </PageHeader>

      {/* Edit form — slide-over style */}
      {editing && (
        <Card className="shadow-card animate-fade-up">
          <CardHeader>
            <CardTitle>Edit Job</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                const reqs = editForm.requirements.split('\n').map((r) => r.trim()).filter(Boolean)
                const updated = await jobsApi.update(job.id, {
                  title: editForm.title,
                  description: editForm.description,
                  requirements: reqs,
                  screeningCriteria: editForm.screeningCriteria.trim() || undefined,
                })
                setJob(updated)
                setEditing(false)
                setSaving(false)
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Description (Markdown)</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Requirements (one per line)</Label>
                <Textarea
                  value={editForm.requirements}
                  onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Screening Criteria</Label>
                  <Badge variant="outline" className="text-xs">Internal only</Badge>
                </div>
                <Textarea
                  value={editForm.screeningCriteria}
                  onChange={(e) => setEditForm({ ...editForm, screeningCriteria: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="jd">
        <TabsList>
          <TabsTrigger value="jd" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Description
          </TabsTrigger>
          <TabsTrigger value="candidates" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Candidates ({candidates.length})
          </TabsTrigger>
          {job.screeningCriteria && (
            <TabsTrigger value="screening">
              Screening
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="jd" className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="py-6">
              <div className="prose prose-sm max-w-none">
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">No candidates yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Upload a CV to get started</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border shadow-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Candidate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} className="group border-b last:border-0 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/jobs/${jobId}/candidates/${c.id}`} className="block">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{c.name}</p>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.matchResult && (
                          <span className="text-lg font-bold">{c.matchResult.overallScore}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.matchResult && (
                          <RecommendationBadge recommendation={c.matchResult.recommendation} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {job.screeningCriteria && (
          <TabsContent value="screening">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Screening Criteria</CardTitle>
                  <Badge variant="outline" className="text-xs">Internal only</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  These criteria are used by AI to score candidates but are not visible to applicants.
                </p>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{job.screeningCriteria}</div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
