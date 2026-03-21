import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import {
  MapPin,
  ArrowRight,
  Sparkles,
  Search,
  Building2,
  BarChart3,
  Upload,
  Brain,
  CheckCircle2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { StaggerContainer, StaggerItem } from '@/components/ui/motion'
import ReactMarkdown from 'react-markdown'
import { jobsApi } from '@/lib/api'
import type { Job } from '@lotushack/shared'

const PAGE_SIZE = 10

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.12, ease: 'easeOut' as const },
  }),
} as const

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, delay: i * 0.1, ease: 'easeOut' as const },
  }),
} as const

const features = [
  {
    icon: Search,
    title: 'Smart Job Matching',
    description: 'AI analyzes your CV and finds the best matching opportunities across multiple platforms.',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    iconColor: 'text-blue-500',
    borderColor: 'group-hover:border-blue-500/30',
  },
  {
    icon: Building2,
    title: 'Company Insights',
    description: 'Deep research on company culture, tech stack, Glassdoor reviews, and growth trajectory.',
    gradient: 'from-violet-500/10 to-purple-500/10',
    iconColor: 'text-violet-500',
    borderColor: 'group-hover:border-violet-500/30',
  },
  {
    icon: BarChart3,
    title: 'Profile Analysis',
    description: 'Understand your strengths and areas for improvement with AI-powered profile scoring.',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    iconColor: 'text-emerald-500',
    borderColor: 'group-hover:border-emerald-500/30',
  },
]

const steps = [
  {
    icon: Upload,
    title: 'Upload Your CV',
    description: 'Submit your resume in PDF format and let our system parse your skills and experience.',
  },
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'Our AI enriches your profile with data from GitHub, LinkedIn, and portfolio sites.',
  },
  {
    icon: CheckCircle2,
    title: 'Get Matched',
    description: 'Receive personalized job matches with explainable scores and company insights.',
  },
]

export function CareersPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const res = await jobsApi.listPublic(page, PAGE_SIZE)
      setJobs((prev) => [...prev, ...res.data])
      setHasMore(res.hasMore)
      setPage((p) => p + 1)
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [page, loading, hasMore])

  useEffect(() => {
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore, loading])

  return (
    <div className="space-y-0">
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/8 via-primary/4 to-background px-6 py-20 text-center md:px-16 md:py-28 lg:py-32">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/3 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-3xl" />
        </div>

        {/* Floating dots pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            custom={0}
            variants={fadeUp}
          >
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Recruitment
            </div>
          </motion.div>

          <motion.h1
            className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl"
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
          >
            Find Your Next{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Opportunity
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
          >
            AI-powered job matching that understands your skills, enriches your profile, and connects you with the right roles.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
          >
            <Button
              size="lg"
              className="gap-2 rounded-xl px-8 text-base shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/25"
              onClick={() => navigate('/careers/discover')}
            >
              <Sparkles className="h-4 w-4" />
              Discover Jobs
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 rounded-xl px-8 text-base"
              onClick={() => navigate('/careers/company/google')}
            >
              <Building2 className="h-4 w-4" />
              Research Companies
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Features Section ─────────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <motion.div
          className="mb-12 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          custom={0}
          variants={fadeUp}
        >
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Everything you need to land your dream job
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Our AI-powered platform goes beyond simple keyword matching to truly understand your potential.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              custom={i}
              variants={scaleIn}
            >
              <Card className={`group h-full border-border/50 transition-all duration-300 hover:shadow-lg ${feature.borderColor}`}>
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient}`}>
                    <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works Section ─────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <motion.div
          className="mb-12 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          custom={0}
          variants={fadeUp}
        >
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Three simple steps to get personalized, AI-powered job recommendations.
          </p>
        </motion.div>

        <div className="relative grid gap-8 sm:grid-cols-3 sm:gap-6">
          {/* Connecting line (desktop only) */}
          <div className="pointer-events-none absolute top-16 right-[16.67%] left-[16.67%] hidden h-px bg-gradient-to-r from-border via-primary/30 to-border sm:block" />

          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className="relative flex flex-col items-center text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              custom={i}
              variants={fadeUp}
            >
              {/* Number badge */}
              <div className="relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
                {i + 1}
              </div>
              {/* Icon */}
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60">
                <step.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <div className="mx-auto h-px w-full max-w-md bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Open Positions Section ────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <motion.div
          className="mb-10 flex items-end justify-between"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0}
          variants={fadeUp}
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Open Positions</h2>
            <p className="mt-2 text-muted-foreground">
              Browse current openings or let AI find the best match for you.
            </p>
          </div>
          <Button
            variant="outline"
            className="hidden gap-2 sm:inline-flex"
            onClick={() => navigate('/careers/discover')}
          >
            <Sparkles className="h-4 w-4" />
            AI Job Discovery
          </Button>
        </motion.div>

        {/* Job listings */}
        {initialLoad ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !initialLoad && jobs.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <MapPin className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="mt-5 text-base font-medium text-muted-foreground">
              No open positions at the moment
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground/70">
              Check back later or use AI Discovery to find opportunities elsewhere
            </p>
            <Button
              className="mt-6 gap-2"
              onClick={() => navigate('/careers/discover')}
            >
              <Sparkles className="h-4 w-4" />
              Try AI Job Discovery
            </Button>
          </motion.div>
        ) : (
          <StaggerContainer className="space-y-4">
            {jobs.map((job) => (
              <StaggerItem key={job.id}>
                <Card className="group border-border/50 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-1 gap-4">
                        {/* Initial avatar */}
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-lg font-semibold text-primary">
                          {job.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <h2 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                              {job.title}
                            </h2>
                            {job.company && (
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {job.company.name}
                              </p>
                            )}
                          </div>

                          {expanded === job.id ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown>{job.description}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {job.description.replace(/[#*_`[\]]/g, '').slice(0, 250)}...
                            </p>
                          )}

                          <button
                            onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {expanded === job.id ? 'Show less' : 'Read more'}
                          </button>

                          {job.requirements.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {job.requirements.map((r, i) => (
                                <Badge key={i} variant="secondary">
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {job.company && (
                          <Link to={`/careers/company/${encodeURIComponent(job.company.name)}`}>
                            <Button variant="ghost" size="sm">
                              Research Company
                            </Button>
                          </Link>
                        )}
                        <Link to={`/careers/${job.id}/apply`}>
                          <Button className="gap-1.5">
                            Apply <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {/* Infinite scroll trigger */}
        <div ref={loaderRef} className="flex justify-center py-4">
          {loading && !initialLoad && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading more...
            </div>
          )}
          {!hasMore && jobs.length > 0 && (
            <p className="text-sm text-muted-foreground">All positions loaded</p>
          )}
        </div>
      </section>
    </div>
  )
}
