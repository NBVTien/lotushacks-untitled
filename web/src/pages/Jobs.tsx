import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import { jobsApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reqInput, setReqInput] = useState('')
  const [screeningCriteria, setScreeningCriteria] = useState('')
  const [previewMode, setPreviewMode] = useState<string>('write')

  useEffect(() => {
    jobsApi.list().then(setJobs)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
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
    setLoading(false)
  }

  const handleToggle = async (e: React.MouseEvent, job: Job) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = await jobsApi.toggleActive(job.id, !job.isActive)
    setJobs(jobs.map((j) => (j.id === updated.id ? { ...j, isActive: updated.isActive } : j)))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Descriptions</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Job'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Senior Backend Engineer (Node.js)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Job Description (Markdown supported)</Label>
                <Tabs value={previewMode} onValueChange={setPreviewMode}>
                  <TabsList>
                    <TabsTrigger value="write">Write</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="write">
                    <Textarea
                      placeholder={'## About the role\n\nDescribe responsibilities, team, tech stack...\n\n## What you\'ll do\n\n- Build microservices\n- Design APIs\n- ...'}
                      rows={12}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="font-mono text-sm"
                      required
                    />
                  </TabsContent>
                  <TabsContent value="preview">
                    <div className="prose prose-sm max-w-none rounded-md border p-4">
                      {description ? (
                        <ReactMarkdown>{description}</ReactMarkdown>
                      ) : (
                        <p className="text-muted-foreground">Nothing to preview</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <Label htmlFor="requirements">Requirements (one per line)</Label>
                <Textarea
                  id="requirements"
                  placeholder="4+ years Node.js/TypeScript&#10;Experience with PostgreSQL&#10;Docker & Kubernetes"
                  rows={5}
                  value={reqInput}
                  onChange={(e) => setReqInput(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="screening">Screening Criteria</Label>
                  <Badge variant="outline" className="text-xs">
                    Internal only
                  </Badge>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Private notes for AI scoring. Candidates won't see this. Use this to add
                  additional filters like preferred universities, specific project experience, etc.
                </p>
                <Textarea
                  id="screening"
                  placeholder="Prefer candidates with:&#10;- Open source contributions&#10;- Experience in fintech or payments&#10;- Based in Ho Chi Minh City&#10;&#10;Red flags:&#10;- Job hopping (less than 1 year per role)&#10;- No GitHub or portfolio"
                  rows={5}
                  value={screeningCriteria}
                  onChange={(e) => setScreeningCriteria(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Job'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {jobs.length === 0 ? (
        <p className="text-muted-foreground">No jobs yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`}>
              <Card className={`transition-shadow hover:shadow-md ${!job.isActive ? 'opacity-50' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <Button
                      variant={job.isActive ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={(e) => handleToggle(e, job)}
                    >
                      {job.isActive ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {job.description.replace(/[#*_`\[\]]/g, '').slice(0, 150)}...
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {job.requirements.length} requirements
                    </span>
                    {job.screeningCriteria && (
                      <Badge variant="outline" className="text-xs">
                        Has screening criteria
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
