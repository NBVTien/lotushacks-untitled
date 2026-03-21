import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Upload, CheckCircle, FileText, X } from 'lucide-react'
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
  const [dragOver, setDragOver] = useState(false)

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
    }
  }

  if (!job) return <p className="text-muted-foreground">Loading...</p>

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg text-center space-y-6 py-16 animate-fade-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Application Submitted!</h1>
          <p className="mt-2 text-muted-foreground">
            Thank you for applying to <strong>{job.title}</strong>. We'll review your
            profile and get back to you at <strong>{candidateEmail}</strong>.
          </p>
        </div>
        <Link to="/careers">
          <Button variant="outline" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Careers
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-up">
      <Link
        to="/careers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Careers
      </Link>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Apply for: {job.title}</CardTitle>
          {job.company && (
            <p className="text-sm text-muted-foreground">{job.company.name}</p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Your full name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@email.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Upload your CV (PDF)</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('cv-file')?.click()}
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-all ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="rounded-md p-1 hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop your CV here</p>
                      <p className="text-xs text-muted-foreground">or click to browse (PDF only)</p>
                    </div>
                  </>
                )}
              </div>
              <input
                id="cv-file"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
            <Button type="submit" disabled={uploading || !file} className="h-11 w-full">
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Submitting...
                </span>
              ) : (
                'Submit Application'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
