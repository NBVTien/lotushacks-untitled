import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { jobsApi, candidatesApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

export function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (jobId) jobsApi.get(jobId).then(setJob)
  }, [jobId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !jobId) return
    setUploading(true)
    await candidatesApi.upload(jobId, file, candidateName, candidateEmail)
    setSubmitted(true)
    setUploading(false)
  }

  if (!job) return <p>Loading...</p>

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg text-center space-y-4 py-12">
        <h1 className="text-2xl font-bold">Application Submitted!</h1>
        <p className="text-muted-foreground">
          Thank you for applying to <strong>{job.title}</strong>. We will review your
          profile and get back to you at <strong>{candidateEmail}</strong>.
        </p>
        <Link to="/careers">
          <Button variant="outline">Back to Careers</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/careers"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to Careers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Apply for: {job.title}</CardTitle>
          {job.company && (
            <p className="text-sm text-muted-foreground">{job.company.name}</p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Your full name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@email.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Upload your CV (PDF)</Label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                className="mt-1 block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
            <Button type="submit" disabled={uploading || !file} className="w-full">
              {uploading ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
