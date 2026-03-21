import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import { jobsApi, candidatesApi } from '@/lib/api'
import type { Job, Candidate } from '@lotushack/shared'

const statusColors: Record<string, string> = {
  uploaded: 'bg-gray-200 text-gray-800',
  parsed: 'bg-blue-100 text-blue-800',
  enriching: 'bg-yellow-100 text-yellow-800',
  enriched: 'bg-orange-100 text-orange-800',
  scoring: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
}

const recommendationColors: Record<string, string> = {
  strong_match: 'bg-green-100 text-green-800',
  good_match: 'bg-blue-100 text-blue-800',
  partial_match: 'bg-yellow-100 text-yellow-800',
  weak_match: 'bg-red-100 text-red-800',
}

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
      <div className="space-y-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">&larr; Back to Jobs</Link>
        <p className="text-muted-foreground">Job not found. It may have been deleted.</p>
      </div>
    )
  }

  if (!job) return <p>Loading...</p>

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Jobs
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
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
            Edit
          </Button>
          <Button
            type="button"
            disabled={uploading}
            onClick={() => document.getElementById('cv-upload')?.click()}
          >
            {uploading ? 'Uploading...' : 'Upload CV'}
          </Button>
          <input
            id="cv-upload"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {editing && (
        <Card>
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
              className="space-y-4"
            >
              <div>
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
              </div>
              <div>
                <Label>Description (Markdown)</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div>
                <Label>Requirements (one per line)</Label>
                <Textarea
                  value={editForm.requirements}
                  onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })}
                  rows={5}
                />
              </div>
              <div>
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
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="jd">
        <TabsList>
          <TabsTrigger value="jd">Job Description</TabsTrigger>
          <TabsTrigger value="candidates">
            Candidates ({candidates.length})
          </TabsTrigger>
          {job.screeningCriteria && (
            <TabsTrigger value="screening">
              Screening Criteria
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="jd" className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{job.description}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {job.requirements.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Requirements</h3>
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

        <TabsContent value="candidates" className="space-y-4">
          {candidates.length === 0 ? (
            <p className="text-muted-foreground">
              No candidates yet. Upload a CV to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => (
                <Link key={c.id} to={`/jobs/${jobId}/candidates/${c.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {c.email && (
                            <p className="text-sm text-muted-foreground">{c.email}</p>
                          )}
                        </div>
                        <Badge className={statusColors[c.status] || ''}>
                          {c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.matchResult && (
                          <>
                            <span className="text-2xl font-bold">
                              {c.matchResult.overallScore}
                            </span>
                            <Badge
                              className={
                                recommendationColors[c.matchResult.recommendation] || ''
                              }
                            >
                              {c.matchResult.recommendation.replace('_', ' ')}
                            </Badge>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {job.screeningCriteria && (
          <TabsContent value="screening">
            <Card>
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
