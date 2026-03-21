import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScoreRing } from '@/components/ui/score-ring'
import { PageTransition } from '@/components/ui/motion'
import { portalApi, jobsApi } from '@/lib/api'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Trash2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  History,
  Search,
  LayoutGrid,
  List,
  Building2,
} from 'lucide-react'
import type { Job, GapAnalysis, SavedJD } from '@lotushack/shared'

const recBadgeColors: Record<string, string> = {
  strong_match: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  good_match: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  partial_match: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  weak_match: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const recLabels: Record<string, string> = {
  strong_match: 'Strong Match',
  good_match: 'Good Match',
  partial_match: 'Partial Match',
  weak_match: 'Weak Match',
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

export function GapAnalysisPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('browse')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  useEffect(() => { document.title = 'Gap Analysis — TalentLens' }, [])

  // Browse jobs state
  const [publicJobs, setPublicJobs] = useState<Job[]>([])
  const [jobsPage, setJobsPage] = useState(1)
  const [jobsHasMore, setJobsHasMore] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [browseView, setBrowseView] = useState<'card' | 'table'>('card')

  // Paste JD state
  const [jdTitle, setJdTitle] = useState('')
  const [jdDescription, setJdDescription] = useState('')
  const [jdRequirements, setJdRequirements] = useState<string[]>([])
  const [newReq, setNewReq] = useState('')

  // History state
  const [savedJds, setSavedJds] = useState<SavedJD[]>([])
  const [savedAnalyses, setSavedAnalyses] = useState<Record<string, GapAnalysis>>({})
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)

  const loadPublicJobs = useCallback(async () => {
    if (jobsLoading || !jobsHasMore) return
    setJobsLoading(true)
    try {
      const res = await jobsApi.listPublic(jobsPage, 10)
      setPublicJobs((prev) => [...prev, ...res.data])
      setJobsHasMore(res.hasMore)
      setJobsPage((p) => p + 1)
    } catch {
      toast.error('Failed to load jobs')
    }
    setJobsLoading(false)
  }, [jobsPage, jobsLoading, jobsHasMore])

  const loadSavedJds = async () => {
    try {
      const jds = await portalApi.listSavedJds()
      setSavedJds(jds)
      // Load persisted analyses from saved JDs
      const analyses: Record<string, GapAnalysis> = {}
      for (const jd of jds) {
        if (jd.lastAnalysis) {
          analyses[jd.id] = jd.lastAnalysis
        }
      }
      setSavedAnalyses((prev) => ({ ...prev, ...analyses }))
    } catch {
      // Might not have any yet
    }
  }

  useEffect(() => {
    loadPublicJobs()
    loadSavedJds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addRequirement = () => {
    const trimmed = newReq.trim()
    if (trimmed && !jdRequirements.includes(trimmed)) {
      setJdRequirements([...jdRequirements, trimmed])
      setNewReq('')
    }
  }

  const removeRequirement = (idx: number) => {
    setJdRequirements(jdRequirements.filter((_, i) => i !== idx))
  }

  const switchToHistoryWithResult = (savedJdId: string, result: GapAnalysis) => {
    setSavedAnalyses((prev) => ({ ...prev, [savedJdId]: result }))
    setExpandedSaved(savedJdId)
    setTab('history')
    // Scroll to result after tab switch
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleAnalyzeFromJob = async (job: Job) => {
    setSelectedJob(job)
    setAnalyzing(true)
    try {
      const saved = await portalApi.savejd({
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        jobId: job.id,
      })
      const result = await portalApi.analyzeGap(saved.id)
      await loadSavedJds()
      toast.success('Gap analysis complete')
      switchToHistoryWithResult(saved.id, result)
    } catch {
      toast.error('Failed to analyze gap')
    }
    setAnalyzing(false)
  }

  const handleAnalyzeFromPaste = async () => {
    if (!jdTitle.trim() || !jdDescription.trim()) {
      toast.error('Please fill in title and description')
      return
    }
    setAnalyzing(true)
    try {
      const saved = await portalApi.savejd({
        title: jdTitle,
        description: jdDescription,
        requirements: jdRequirements,
      })
      const result = await portalApi.analyzeGap(saved.id)
      await loadSavedJds()
      toast.success('Gap analysis complete')
      switchToHistoryWithResult(saved.id, result)
      // Clear form
      setJdTitle('')
      setJdDescription('')
      setJdRequirements([])
    } catch {
      toast.error('Failed to analyze gap')
    }
    setAnalyzing(false)
  }

  const handleAnalyzeSaved = async (jd: SavedJD) => {
    setAnalyzingId(jd.id)
    try {
      const result = await portalApi.analyzeGap(jd.id)
      setSavedAnalyses((prev) => ({ ...prev, [jd.id]: result }))
      setExpandedSaved(jd.id)
      toast.success('Gap analysis complete')
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      toast.error('Failed to analyze gap')
    }
    setAnalyzingId(null)
  }

  const handleDeleteSaved = async (id: string) => {
    try {
      await portalApi.deleteSavedJd(id)
      setSavedJds((prev) => prev.filter((jd) => jd.id !== id))
      setSavedAnalyses((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (expandedSaved === id) setExpandedSaved(null)
      toast.success('Saved JD deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const navigateToResources = (a: GapAnalysis) => {
    const params = new URLSearchParams()
    params.set('gaps', JSON.stringify(a.gaps))
    params.set('skills', JSON.stringify(a.skillScores?.map((s) => s.name) || []))
    params.set('analysisId', a.id)
    params.set('savedJdId', a.savedJdId)
    navigate(`/portal/gap-analysis/${a.id}/resources?${params.toString()}`)
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link
            to="/portal"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Profile
          </Link>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Gap Analysis</h1>
          <p className="mt-2 text-muted-foreground">
            Compare your profile against a job description to find skill gaps
          </p>
        </div>

        {/* Loading overlay when analyzing from Browse/Paste */}
        {analyzing && (
          <div className="flex justify-center py-6">
            <div className="text-center space-y-2">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">Running gap analysis...</p>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="browse">Browse Jobs</TabsTrigger>
            <TabsTrigger value="paste">Paste JD</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              History
              {savedJds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
                  {savedJds.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Browse Jobs Tab */}
          <TabsContent value="browse" className="space-y-4">
            {/* Search + view toggle row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or company…"
                  className="pl-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 shrink-0">
                <button
                  onClick={() => setBrowseView('card')}
                  title="Card view"
                  className={`rounded-md p-1.5 transition-colors ${browseView === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setBrowseView('table')}
                  title="Table view"
                  className={`rounded-md p-1.5 transition-colors ${browseView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tag filters */}
            {publicJobs.length > 0 && (() => {
              const tagCounts = new Map<string, number>()
              for (const job of publicJobs) {
                for (const r of job.requirements) {
                  tagCounts.set(r, (tagCounts.get(r) ?? 0) + 1)
                }
              }
              const topTags = [...tagCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 16)
                .map(([tag]) => tag)
              if (topTags.length === 0) return null
              return (
                <div className="flex flex-wrap gap-1.5">
                  {topTags.map((tag) => {
                    const active = activeTags.has(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => setActiveTags((prev) => {
                          const next = new Set(prev)
                          active ? next.delete(tag) : next.add(tag)
                          return next
                        })}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                  {activeTags.size > 0 && (
                    <button
                      onClick={() => setActiveTags(new Set())}
                      className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Filtered results */}
            {(() => {
              const q = search.toLowerCase()
              const filtered = publicJobs.filter((job) => {
                const matchesSearch = !q ||
                  job.title.toLowerCase().includes(q) ||
                  (job.company?.name ?? '').toLowerCase().includes(q)
                const matchesTags = activeTags.size === 0 ||
                  [...activeTags].every((tag) => job.requirements.includes(tag))
                return matchesSearch && matchesTags
              })

              if (filtered.length === 0 && !jobsLoading) {
                return (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">No jobs match your search.</p>
                    {(search || activeTags.size > 0) && (
                      <button
                        onClick={() => { setSearch(''); setActiveTags(new Set()) }}
                        className="mt-2 text-sm text-primary hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )
              }

              return (
                <>
                  {(search || activeTags.size > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {filtered.length} job{filtered.length !== 1 ? 's' : ''} found
                    </p>
                  )}

                  {browseView === 'table' ? (
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b border-border/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Company</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Requirements</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {filtered.map((job) => (
                            <tr
                              key={job.id}
                              className={`hover:bg-muted/20 transition-colors cursor-pointer ${selectedJob?.id === job.id ? 'bg-primary/5' : ''}`}
                              onClick={() => setSelectedJob(job)}
                            >
                              <td className="px-4 py-3 font-medium">{job.title}</td>
                              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                {job.company ? (
                                  <span className="flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    {job.company.name}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <div className="flex flex-wrap gap-1">
                                  {job.requirements.slice(0, 3).map((r, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                                  ))}
                                  {job.requirements.length > 3 && (
                                    <Badge variant="outline" className="text-xs">+{job.requirements.length - 3}</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  disabled={analyzing}
                                  onClick={(e) => { e.stopPropagation(); handleAnalyzeFromJob(job) }}
                                >
                                  {analyzing && selectedJob?.id === job.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : 'Analyze'}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((job) => (
                        <Card
                          key={job.id}
                          className={`cursor-pointer border-border/50 shadow-sm transition-all duration-200 hover:shadow-md ${
                            selectedJob?.id === job.id ? 'border-primary ring-1 ring-primary/20' : ''
                          }`}
                          onClick={() => setSelectedJob(job)}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="font-semibold">{job.title}</h3>
                                {job.company && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    {job.company.name}
                                  </p>
                                )}
                                {job.requirements.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {job.requirements.slice(0, 6).map((r, i) => (
                                      <Badge
                                        key={i}
                                        variant={activeTags.has(r) ? 'default' : 'secondary'}
                                        className="text-xs cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setActiveTags((prev) => {
                                            const next = new Set(prev)
                                            prev.has(r) ? next.delete(r) : next.add(r)
                                            return next
                                          })
                                        }}
                                      >
                                        {r}
                                      </Badge>
                                    ))}
                                    {job.requirements.length > 6 && (
                                      <Badge variant="outline" className="text-xs">+{job.requirements.length - 6}</Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                disabled={analyzing}
                                onClick={(e) => { e.stopPropagation(); handleAnalyzeFromJob(job) }}
                              >
                                {analyzing && selectedJob?.id === job.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : 'Analyze'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}

            {jobsHasMore && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={loadPublicJobs} disabled={jobsLoading}>
                  {jobsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More Jobs'}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Paste JD Tab */}
          <TabsContent value="paste" className="space-y-4">
            <Card>
              <CardContent className="py-6 space-y-4">
                <div>
                  <Label className="mb-1.5">Job Title</Label>
                  <Input
                    value={jdTitle}
                    onChange={(e) => setJdTitle(e.target.value)}
                    placeholder="Senior Frontend Developer"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Job Description</Label>
                  <Textarea
                    value={jdDescription}
                    onChange={(e) => setJdDescription(e.target.value)}
                    placeholder="Paste the full job description here..."
                    className="min-h-32"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Requirements</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newReq}
                      onChange={(e) => setNewReq(e.target.value)}
                      placeholder="Add a requirement"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addRequirement()
                        }
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={addRequirement}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {jdRequirements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {jdRequirements.map((req, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {req}
                          <button
                            onClick={() => removeRequirement(i)}
                            className="ml-1 rounded-full p-0.5 hover:bg-muted"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleAnalyzeFromPaste}
                  disabled={analyzing || !jdTitle.trim() || !jdDescription.trim()}
                  className="w-full gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Save & Analyze'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {savedJds.length === 0 ? (
              <div className="text-center py-12">
                <History className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No analysis history yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse jobs or paste a JD to run your first gap analysis.
                </p>
              </div>
            ) : (
              savedJds.map((jd) => {
                const isExpanded = expandedSaved === jd.id
                const analysis = savedAnalyses[jd.id]
                const isAnalyzing = analyzingId === jd.id

                return (
                  <Card
                    key={jd.id}
                    className={`border-border/50 shadow-sm transition-all duration-200 ${
                      isExpanded ? 'ring-1 ring-primary/20 border-primary/30' : ''
                    }`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setExpandedSaved(isExpanded ? null : jd.id)}
                        >
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{jd.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {jd.source}
                            </Badge>
                            {analysis && (
                              <Badge className={`text-xs ${recBadgeColors[analysis.recommendation] || ''}`}>
                                {analysis.overallScore}%
                              </Badge>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Saved {new Date(jd.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnalyzeSaved(jd)}
                            disabled={isAnalyzing}
                          >
                            {isAnalyzing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : analysis ? (
                              'Re-analyze'
                            ) : (
                              'Analyze'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSaved(jd.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          {/* JD details */}
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {jd.description}
                          </p>
                          {jd.requirements.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {jd.requirements.map((r, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Analysis results inline */}
                          {analysis && (
                            <div ref={expandedSaved === jd.id ? resultsRef : undefined} className="mt-4">
                              <AnalysisResults
                                analysis={analysis}
                                onFindResources={() => navigateToResources(analysis)}
                                compact
                              />
                            </div>
                          )}

                          {!analysis && !isAnalyzing && (
                            <div className="mt-4 text-center py-4">
                              <p className="text-sm text-muted-foreground mb-2">
                                No analysis results yet for this JD.
                              </p>
                              <Button
                                size="sm"
                                onClick={() => handleAnalyzeSaved(jd)}
                              >
                                Run Analysis
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  )
}

function AnalysisResults({
  analysis,
  onFindResources,
  compact = false,
}: {
  analysis: GapAnalysis
  onFindResources: () => void
  compact?: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Score + Recommendation */}
      <Card>
        <CardContent className={compact ? 'py-4' : 'py-6'}>
          <div className="flex items-center gap-6">
            <ScoreRing score={analysis.overallScore} size={compact ? 80 : 120} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={recBadgeColors[analysis.recommendation] || ''}>
                  {recLabels[analysis.recommendation] || analysis.recommendation}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {analysis.explanation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strengths & Gaps */}
      <div className="grid gap-4 md:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4" />
                Strengths
              </h3>
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {analysis.gaps.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <h3 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4" />
                Gaps
              </h3>
              <ul className="space-y-2">
                {analysis.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Skill Scores */}
      {analysis.skillScores && analysis.skillScores.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="font-semibold mb-3">Skill Assessment</h3>
            <div className="space-y-2">
              {analysis.skillScores.map((skill, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                >
                  <div className="flex-1">
                    <span className="font-medium text-sm">{skill.name}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{skill.evidence}</p>
                  </div>
                  <Badge
                    className={
                      skill.level === 'yes'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : skill.level === 'partial'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }
                  >
                    {skill.level === 'yes' ? 'Has Skill' : skill.level === 'partial' ? 'Partial' : 'Missing'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Improvement Areas */}
      {analysis.improvementAreas && analysis.improvementAreas.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Improvement Areas
            </h3>
            <div className="space-y-2">
              {analysis.improvementAreas.map((area, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{area.skill}</span>
                    <Badge className={priorityColors[area.priority] || ''} variant="secondary">
                      {area.priority} priority
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{area.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Find Learning Resources */}
      <Button onClick={onFindResources} className="w-full gap-2" size="lg">
        <BookOpen className="h-4 w-4" />
        Find Learning Resources
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
