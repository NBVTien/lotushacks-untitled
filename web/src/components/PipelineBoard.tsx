import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RecommendationBadge } from '@/components/ui/status-badge'
import { Loader2, GripVertical, Users } from 'lucide-react'
import { toast } from 'sonner'
import { candidatesApi } from '@/lib/api'
import type { Candidate, PipelineStage } from '@lotushack/shared'

const STAGES: { key: PipelineStage; label: string; color: string; bg: string }[] = [
  {
    key: 'new',
    label: 'New',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40',
  },
  {
    key: 'screening',
    label: 'Screening',
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-50/60 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/40',
  },
  {
    key: 'interview',
    label: 'Interview',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40',
  },
  {
    key: 'offer',
    label: 'Offer',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40',
  },
  {
    key: 'hired',
    label: 'Hired',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/40',
  },
]

function getScoreDotColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

interface PipelineBoardProps {
  jobId: string
}

export function PipelineBoard({ jobId }: PipelineBoardProps) {
  const navigate = useNavigate()
  const [pipeline, setPipeline] = useState<Record<PipelineStage, Candidate[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null)
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null)
  const dragSourceStage = useRef<PipelineStage | null>(null)

  const loadPipeline = useCallback(async () => {
    try {
      const data = await candidatesApi.getPipeline(jobId)
      setPipeline(data)
    } catch {
      toast.error('Failed to load pipeline data')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    loadPipeline()
  }, [loadPipeline])

  const handleDragStart = (e: React.DragEvent, candidate: Candidate, fromStage: PipelineStage) => {
    setDraggedCandidate(candidate)
    dragSourceStage.current = fromStage
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', candidate.id)
  }

  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stage)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = async (e: React.DragEvent, toStage: PipelineStage) => {
    e.preventDefault()
    setDragOverStage(null)

    if (!draggedCandidate || !pipeline) return
    const fromStage = dragSourceStage.current
    if (fromStage === toStage) {
      setDraggedCandidate(null)
      return
    }

    // Optimistic update
    const prevPipeline = { ...pipeline }
    const updatedPipeline = { ...pipeline }
    if (fromStage) {
      updatedPipeline[fromStage] = updatedPipeline[fromStage].filter(
        (c) => c.id !== draggedCandidate.id
      )
    }
    updatedPipeline[toStage] = [
      ...updatedPipeline[toStage],
      { ...draggedCandidate, pipelineStage: toStage },
    ]
    setPipeline(updatedPipeline)
    setDraggedCandidate(null)

    try {
      await candidatesApi.updatePipelineStage(jobId, draggedCandidate.id, toStage)
    } catch {
      // Revert on error
      setPipeline(prevPipeline)
      toast.error('Failed to update pipeline stage')
    }
  }

  const handleStageChange = async (candidate: Candidate, fromStage: PipelineStage, toStage: PipelineStage) => {
    if (!pipeline || fromStage === toStage) return

    // Optimistic update
    const prevPipeline = { ...pipeline }
    const updatedPipeline = { ...pipeline }
    updatedPipeline[fromStage] = updatedPipeline[fromStage].filter((c) => c.id !== candidate.id)
    updatedPipeline[toStage] = [
      ...updatedPipeline[toStage],
      { ...candidate, pipelineStage: toStage },
    ]
    setPipeline(updatedPipeline)

    try {
      await candidatesApi.updatePipelineStage(jobId, candidate.id, toStage)
    } catch {
      setPipeline(prevPipeline)
      toast.error('Failed to update pipeline stage')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading pipeline...</span>
      </div>
    )
  }

  if (!pipeline) return null

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: `${STAGES.length * 260}px` }}>
        {STAGES.map((stage) => {
          const candidates = pipeline[stage.key] || []
          const isOver = dragOverStage === stage.key
          return (
            <div
              key={stage.key}
              className={`flex w-64 shrink-0 flex-col rounded-xl border transition-colors ${stage.bg} ${
                isOver ? 'ring-2 ring-primary/50' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <h3 className={`text-sm font-semibold ${stage.color}`}>{stage.label}</h3>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium ${stage.color} bg-white/60 dark:bg-white/10`}
                >
                  {candidates.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {candidates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-5 w-5 text-muted-foreground/40" />
                    <p className="mt-1.5 text-xs text-muted-foreground/60">No candidates</p>
                  </div>
                ) : (
                  candidates.map((c) => (
                    <Card
                      key={c.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, c, stage.key)}
                      onDragEnd={() => {
                        setDraggedCandidate(null)
                        setDragOverStage(null)
                      }}
                      className={`cursor-grab bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${
                        draggedCandidate?.id === c.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => navigate(`/recruiter/jobs/${jobId}/candidates/${c.id}`)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            {c.email && (
                              <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                            )}
                          </div>
                          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        </div>

                        {c.matchResult && (
                          <div className="mt-2 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                              {c.matchResult.overallScore}
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${getScoreDotColor(c.matchResult.overallScore)}`}
                              />
                            </span>
                            <RecommendationBadge recommendation={c.matchResult.recommendation} />
                          </div>
                        )}
                      </div>

                      {/* Quick stage change dropdown */}
                      <div className="mt-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={stage.key}
                          onValueChange={(val) =>
                            handleStageChange(c, stage.key, val as PipelineStage)
                          }
                        >
                          <SelectTrigger size="sm" className="w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => (
                              <SelectItem key={s.key} value={s.key}>
                                <span className={s.color}>{s.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
