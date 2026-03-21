import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTransition } from '@/components/ui/motion'
import { useAuth } from '@/lib/auth'
import { portalApi } from '@/lib/api'
import { toast } from 'sonner'
import {
  Upload,
  FileText,
  Loader2,
  ArrowRight,
  User,
  GraduationCap,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import type { ParsedCVData } from '@lotushack/shared'

export function CandidatePortalPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'My Profile — TalentLens' }, [])
  const [cvText, setCvText] = useState<string | null>(null)
  const [parsedCV, setParsedCV] = useState<ParsedCVData | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const profile = await portalApi.getProfile()
      setCvText(profile.cvText || null)
      setParsedCV(profile.parsedCV || null)
    } catch {
      // Profile might not have CV yet, that's OK
    }
    setLoading(false)
  }

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file')
      return
    }
    setUploading(true)
    try {
      const result = await portalApi.uploadCv(file)
      setCvText(result.cvText || null)
      setParsedCV(result.parsedCV || null)
      toast.success('CV uploaded and parsed successfully')
    } catch {
      toast.error('Failed to upload CV')
    }
    setUploading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-4xl flex justify-center py-20">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back, {user?.name || 'Candidate'}
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => navigate('/portal/gap-analysis')}
            disabled={!parsedCV}
          >
            <Sparkles className="h-4 w-4" />
            Analyze Against JD
          </Button>
        </div>

        {/* CV Upload Section */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Resume / CV</h2>
                <p className="text-sm text-muted-foreground">
                  {cvText ? 'Your CV has been uploaded and parsed' : 'Upload your CV to get started'}
                </p>
              </div>
            </div>

            {/* Upload area */}
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 hover:border-primary/40'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploading ? (
                <div className="space-y-2">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading and parsing your CV...</p>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium">
                    {cvText ? 'Upload a new CV to replace' : 'Drag & drop your PDF here'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">or</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parsed CV Data */}
        {parsedCV && (
          <>
            {/* Skills */}
            {parsedCV.skills && parsedCV.skills.length > 0 && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Sparkles className="h-5 w-5 text-emerald-500" />
                    </div>
                    <h2 className="text-lg font-semibold">Skills</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedCV.skills.map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {parsedCV.summary && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <User className="h-5 w-5 text-blue-500" />
                    </div>
                    <h2 className="text-lg font-semibold">Summary</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{parsedCV.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Experience */}
            {parsedCV.experience && parsedCV.experience.length > 0 && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                      <Briefcase className="h-5 w-5 text-violet-500" />
                    </div>
                    <h2 className="text-lg font-semibold">Experience</h2>
                  </div>
                  <div className="space-y-4">
                    {parsedCV.experience.map((exp, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/50 p-4 space-y-1"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{exp.title}</p>
                            <p className="text-sm text-muted-foreground">{exp.company}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {exp.duration}
                          </Badge>
                        </div>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {parsedCV.education && parsedCV.education.length > 0 && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                      <GraduationCap className="h-5 w-5 text-amber-500" />
                    </div>
                    <h2 className="text-lg font-semibold">Education</h2>
                  </div>
                  <div className="space-y-3">
                    {parsedCV.education.map((edu, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                      >
                        <div>
                          <p className="font-medium">{edu.degree}</p>
                          <p className="text-sm text-muted-foreground">{edu.school}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {edu.year}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Quick Actions */}
        {parsedCV && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Ready to find your gaps?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Compare your profile against any job description and get actionable insights.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => navigate('/portal/gap-analysis')}
                >
                  Gap Analysis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  )
}
