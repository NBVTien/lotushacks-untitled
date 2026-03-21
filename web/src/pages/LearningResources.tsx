import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTransition } from '@/components/ui/motion'
import { useAuth } from '@/lib/auth'
import {
  BookOpen,
  ExternalLink,
  Loader2,
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Lightbulb,
} from 'lucide-react'
import type { LearningResource, LearningResourceResult } from '@lotushack/shared'

const sourceBadgeColors: Record<string, string> = {
  'dev.to': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  'github.com': 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
  Medium: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  GitHub: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
}

const typeBadgeColors: Record<string, string> = {
  blog: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  project: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  course: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  article: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
}

interface SkillState {
  status: 'idle' | 'loading' | 'complete' | 'error'
  resources: LearningResource[]
  logs: string[]
  expanded: boolean
}

export function LearningResourcesPage() {
  const [searchParams] = useSearchParams()
  const { token } = useAuth()
  const [skillStates, setSkillStates] = useState<Record<string, SkillState>>({})
  const abortRefs = useRef<Record<string, AbortController>>({})

  useEffect(() => { document.title = 'Learning Resources — TalentLens' }, [])

  const gaps: string[] = (() => {
    try { return JSON.parse(searchParams.get('gaps') || '[]') }
    catch { return [] }
  })()

  const savedJdId = searchParams.get('savedJdId') || ''

  // Initialize skill states
  useEffect(() => {
    const initial: Record<string, SkillState> = {}
    for (const gap of gaps) {
      initial[gap] = { status: 'idle', resources: [], logs: [], expanded: false }
    }
    setSkillStates(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup abort controllers
  useEffect(() => {
    return () => {
      Object.values(abortRefs.current).forEach(c => c.abort())
    }
  }, [])

  const exploreSkill = useCallback(async (skill: string) => {
    // Update state to loading
    setSkillStates(prev => ({
      ...prev,
      [skill]: { status: 'loading', resources: [], logs: [], expanded: true }
    }))

    // Abort any previous request for this skill
    abortRefs.current[skill]?.abort()
    const abort = new AbortController()
    abortRefs.current[skill] = abort

    try {
      const response = await fetch('http://localhost:4005/candidate-portal/learning-resources/skill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ skill, savedJdId }),
        signal: abort.signal,
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)
            if (event.type === 'progress' && event.message) {
              setSkillStates(prev => ({
                ...prev,
                [skill]: {
                  ...prev[skill],
                  logs: [...(prev[skill]?.logs || []), event.message],
                }
              }))
            }
            if (event.type === 'skill-complete' && event.result) {
              const result = event.result as LearningResourceResult
              setSkillStates(prev => ({
                ...prev,
                [skill]: {
                  ...prev[skill],
                  status: 'complete',
                  resources: result.resources || [],
                }
              }))
            }
            if (event.type === 'error') {
              setSkillStates(prev => ({
                ...prev,
                [skill]: {
                  ...prev[skill],
                  status: 'error',
                  logs: [...(prev[skill]?.logs || []), `Error: ${event.message}`],
                }
              }))
            }
          } catch { /* skip malformed */ }
        }
      }

      // Ensure status is set to complete
      setSkillStates(prev => {
        if (prev[skill]?.status === 'loading') {
          return { ...prev, [skill]: { ...prev[skill], status: 'complete' } }
        }
        return prev
      })
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setSkillStates(prev => ({
          ...prev,
          [skill]: {
            ...prev[skill],
            status: 'error',
            logs: [...(prev[skill]?.logs || []), `Error: ${(err as Error).message}`],
          }
        }))
      }
    }
  }, [token, savedJdId])

  const toggleExpanded = (skill: string) => {
    setSkillStates(prev => ({
      ...prev,
      [skill]: { ...prev[skill], expanded: !prev[skill]?.expanded }
    }))
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link
            to="/careers/portal/gap-analysis"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Gap Analysis
          </Link>
        </div>

        <div className="text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="text-3xl font-bold tracking-tight">Learning Mentor</h1>
          <p className="mt-2 text-muted-foreground">
            Select a skill gap to explore — your AI mentor will find and summarize the best resources
          </p>
        </div>

        {gaps.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No skill gaps found. Run a gap analysis first.</p>
          </div>
        )}

        <div className="space-y-4">
          {gaps.map((gap: string) => {
            const state = skillStates[gap] || { status: 'idle', resources: [], logs: [], expanded: false }
            return (
              <SkillCard
                key={gap}
                skill={gap}
                state={state}
                onExplore={() => exploreSkill(gap)}
                onToggle={() => toggleExpanded(gap)}
              />
            )
          })}
        </div>
      </div>
    </PageTransition>
  )
}

function SkillCard({
  skill,
  state,
  onExplore,
  onToggle,
}: {
  skill: string
  state: SkillState
  onExplore: () => void
  onToggle: () => void
}) {
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.expanded) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [state.logs.length, state.expanded])

  const statusIcon = {
    idle: null,
    loading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    complete: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    error: null,
  }[state.status]

  return (
    <Card className={`border-border/50 shadow-sm transition-all duration-200 ${
      state.expanded ? 'ring-1 ring-primary/20 border-primary/30' : ''
    }`}>
      <CardContent className="py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 flex-1 text-left"
            onClick={onToggle}
          >
            <BookOpen className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold">{skill}</span>
            {statusIcon}
            {state.status === 'complete' && state.resources.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {state.resources.length} resources
              </Badge>
            )}
            {state.expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
            )}
          </button>
          <div className="ml-3">
            {state.status === 'idle' && (
              <Button size="sm" onClick={onExplore} className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Explore
              </Button>
            )}
            {state.status === 'loading' && (
              <Button size="sm" disabled className="gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </Button>
            )}
            {state.status === 'complete' && (
              <Button size="sm" variant="outline" onClick={onExplore} className="gap-1.5">
                Refresh
              </Button>
            )}
            {state.status === 'error' && (
              <Button size="sm" variant="outline" onClick={onExplore} className="gap-1.5">
                Retry
              </Button>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {state.expanded && (
          <div className="mt-4 space-y-4">
            {/* Progress logs (collapsible, shown during loading) */}
            {state.logs.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/40">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-muted-foreground font-mono">Progress</span>
                  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                    state.status === 'loading' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                  }`} />
                </div>
                <div className="max-h-32 overflow-y-auto px-3 pb-2 font-mono text-xs">
                  {state.logs.map((log, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed">{log}</p>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* Resources with mentor-style display */}
            {state.resources.length > 0 && (
              <div className="space-y-3">
                {state.resources.map((resource, i) => (
                  <ResourceCard key={i} resource={resource} />
                ))}
              </div>
            )}

            {/* Empty state after completion */}
            {state.status === 'complete' && state.resources.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No resources found for this skill. Try refreshing.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ResourceCard({ resource }: { resource: LearningResource }) {
  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3 hover:border-primary/20 transition-colors">
      {/* Title + link */}
      <div className="flex items-start justify-between gap-2">
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-sm hover:underline hover:text-primary transition-colors flex items-center gap-1.5"
        >
          {resource.title}
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </a>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={
            sourceBadgeColors[resource.source] ||
            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
          }>
            {resource.source}
          </Badge>
          <Badge className={
            typeBadgeColors[resource.type] ||
            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
          }>
            {resource.type}
          </Badge>
        </div>
      </div>

      {/* AI Summary */}
      {resource.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {resource.summary}
        </p>
      )}

      {/* Key Takeaways */}
      {resource.keyTakeaways && resource.keyTakeaways.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary/80">
            <Lightbulb className="h-3.5 w-3.5" />
            Key takeaways
          </div>
          <ul className="space-y-1 ml-5">
            {resource.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/40 shrink-0" />
                {takeaway}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fallback: show description if no summary */}
      {!resource.summary && resource.description && (
        <p className="text-xs text-muted-foreground">{resource.description}</p>
      )}
    </div>
  )
}
