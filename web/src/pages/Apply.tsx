import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Upload, CheckCircle, FileText, X, User, File, ArrowRight } from 'lucide-react'
import { PageTransition } from '@/components/ui/motion'
import { toast } from 'sonner'
import { jobsApi, candidatesApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

const STEPS = [
  { label: 'Your Info', icon: User },
  { label: 'Upload CV', icon: File },
  { label: 'Review & Submit', icon: CheckCircle },
]

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

type ApplyField = 'name' | 'email' | 'file'

export function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [step, setStep] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ApplyField, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<ApplyField, boolean>>>({})

  const validateField = (field: ApplyField): string | undefined => {
    if (field === 'name' && !candidateName.trim()) return 'Name is required'
    if (field === 'email') {
      if (!candidateEmail.trim()) return 'Email is required'
      if (!isValidEmail(candidateEmail)) return 'Please enter a valid email'
    }
    if (field === 'file' && !file) return 'Please upload your CV'
    return undefined
  }

  const handleFieldBlur = (field: ApplyField) => {
    setTouched((t) => ({ ...t, [field]: true }))
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field) }))
  }

  const validateAll = () => {
    const fields: ApplyField[] = ['name', 'email', 'file']
    const errs: Partial<Record<ApplyField, string>> = {}
    const t: Partial<Record<ApplyField, boolean>> = {}
    for (const f of fields) {
      errs[f] = validateField(f)
      t[f] = true
    }
    setFieldErrors(errs)
    setTouched(t)
    return !Object.values(errs).some(Boolean)
  }

  useEffect(() => {
    if (jobId) jobsApi.get(jobId).then(setJob)
  }, [jobId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAll()) return
    if (!file || !jobId) return
    setUploading(true)
    try {
      await candidatesApi.upload(jobId, file, candidateName, candidateEmail)
      setSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch {
      toast.error('Failed to submit application. Please try again.')
    }
    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
      setFieldErrors((prev) => ({ ...prev, file: undefined }))
    }
  }

  if (!job) return <p className="text-muted-foreground">Loading...</p>

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg text-center space-y-6 py-16">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <CheckCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Application Submitted!</h1>
          <p className="mt-2 text-muted-foreground">
            Thank you for applying to <strong>{job.title}</strong>. We'll review your profile and
            get back to you at <strong>{candidateEmail}</strong>.
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
    <PageTransition>
      <div className="mx-auto max-w-lg space-y-6">
        <Link
          to="/careers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Careers
        </Link>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-4">
          {STEPS.map((s, i) => {
            const isCompleted = i < step
            const isCurrent = i === step
            return (
              <div key={s.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                      isCompleted
                        ? 'bg-primary text-primary-foreground'
                        : isCurrent
                          ? 'ring-2 ring-primary text-primary bg-background'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Apply for: {job.title}</CardTitle>
            {job.company && <p className="text-sm text-muted-foreground">{job.company.name}</p>}
          </CardHeader>
          <CardContent>
            {/* Step 0: Your Info */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    value={candidateName}
                    onChange={(e) => {
                      setCandidateName(e.target.value)
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    onBlur={() => handleFieldBlur('name')}
                    className={`h-12 text-base ${touched.name && fieldErrors.name ? 'border-destructive' : ''}`}
                  />
                  {touched.name && fieldErrors.name && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@email.com"
                    value={candidateEmail}
                    onChange={(e) => {
                      setCandidateEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    onBlur={() => handleFieldBlur('email')}
                    className={`h-12 text-base ${touched.email && fieldErrors.email ? 'border-destructive' : ''}`}
                  />
                  {touched.email && fieldErrors.email && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>
                  )}
                </div>
                <Button
                  type="button"
                  disabled={!candidateName.trim() || !candidateEmail.trim() || !isValidEmail(candidateEmail)}
                  className="h-12 w-full text-base gap-2"
                  onClick={() => setStep(1)}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Step 1: Upload CV */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Upload your CV (PDF)</Label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('cv-file')?.click()}
                    className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors duration-200 ${
                      dragOver
                        ? 'border-primary/50 bg-primary/5'
                        : file
                          ? 'border-border bg-muted/30'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                  >
                    {file ? (
                      <div className="flex items-center gap-4 rounded-lg border bg-card p-3 shadow-sm w-full">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <FileText className="h-5 w-5 text-primary/60" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFile(null)
                          }}
                          className="rounded-md p-1.5 hover:bg-muted transition-colors"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Upload className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Drop your CV here</p>
                          <p className="text-xs text-muted-foreground">
                            or click to browse (PDF only)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    id="cv-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setFile(f)
                      if (f) setFieldErrors((prev) => ({ ...prev, file: undefined }))
                    }}
                    className="hidden"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 text-base"
                    onClick={() => setStep(0)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={!file}
                    className="h-12 flex-1 text-base gap-2"
                    onClick={() => setStep(2)}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Review & Submit */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium">{candidateName}</span>
                  </div>
                  <div className="border-t" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-medium">{candidateEmail}</span>
                  </div>
                  <div className="border-t" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CV</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {file?.name}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 text-base"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploading}
                    className="h-12 flex-1 text-base"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Submitting...
                      </span>
                    ) : (
                      'Submit Application'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
