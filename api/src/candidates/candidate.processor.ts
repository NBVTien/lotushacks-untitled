import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Job } from 'bullmq'
import { CandidateEntity } from '../database'
import { PdfService } from './pdf.service'
import { MinioService } from './minio.service'
import { GitHubApiService } from '../enrichment/github-api.service'
import { ExtendedEnrichmentService } from '../enrichment/extended-enrichment.service'
import { MatchingService } from '../matching/matching.service'
import type { CandidateStatus, ExtendedEnrichmentType } from '@lotushack/shared'

export interface CandidateJobData {
  candidateId: string
  cvFileName: string
  jobDescription: string
  jobRequirements: string[]
  jobScreeningCriteria: string | null
  overrideName?: string
  overrideEmail?: string
  enrichOnly?: boolean
  extendedEnrichTypes?: string[]
}

@Processor('candidate-processing')
export class CandidateProcessor extends WorkerHost {
  private readonly logger = new Logger(CandidateProcessor.name)

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly repo: Repository<CandidateEntity>,
    private readonly pdf: PdfService,
    private readonly minio: MinioService,
    private readonly githubApi: GitHubApiService,
    private readonly extendedEnrichment: ExtendedEnrichmentService,
    private readonly matching: MatchingService
  ) {
    super()
  }

  async process(job: Job<CandidateJobData>): Promise<void> {
    const data = job.data

    if (data.extendedEnrichTypes?.length) {
      return this.processExtendedEnrich(job)
    }
    if (data.enrichOnly) {
      return this.processEnrichAndScore(job)
    }
    return this.processFullPipeline(job)
  }

  /** Full pipeline: parse PDF → enrich → score */
  private async processFullPipeline(job: Job<CandidateJobData>): Promise<void> {
    const {
      candidateId,
      cvFileName,
      jobDescription,
      jobRequirements,
      jobScreeningCriteria,
      overrideName,
      overrideEmail,
    } = job.data
    this.logger.log(
      `[Worker] Full pipeline for ${candidateId} (job: ${job.id}, attempt: ${job.attemptsMade + 1})`
    )

    const candidate = await this.repo.findOne({ where: { id: candidateId } })
    if (!candidate) {
      this.logger.error(`[Worker] Candidate ${candidateId} not found`)
      return
    }

    try {
      // Step 1: Parse CV with OpenAI
      this.logger.log(`[Worker] Step 1/3: Parsing CV (${cvFileName})`)
      await this.updateStatus(candidateId, 'parsed')
      await job.updateProgress(5)

      const presignedUrl = await this.minio.getUrl(cvFileName)
      const response = await fetch(presignedUrl)
      const buffer = Buffer.from(await response.arrayBuffer())
      const parsed = await this.pdf.parseCV(buffer, cvFileName)
      await job.updateProgress(30)

      const updateData: Record<string, unknown> = {
        name: overrideName || parsed.name,
        cvText: parsed.rawText,
        links: parsed.links,
        parsedCV: {
          summary: parsed.summary,
          skills: parsed.skills,
          experience: parsed.experience,
          education: parsed.education,
        },
      }
      if (overrideEmail || parsed.email) updateData.email = overrideEmail || parsed.email
      if (parsed.phone) updateData.phone = parsed.phone
      await this.repo.update(candidateId, updateData)
      this.logger.log(
        `[Worker] CV parsed: name="${overrideName || parsed.name}", skills=${parsed.skills.length}, exp=${parsed.experience.length}`
      )

      // Step 2: GitHub enrichment (immediate — uses direct API, fast)
      let enrichment: import('@lotushack/shared').EnrichedProfile = { github: null, linkedin: null }
      try {
        if (parsed.links.github) {
          this.logger.log(`[Worker] Step 2/3: GitHub enrichment (${parsed.links.github})`)
          await this.updateStatus(candidateId, 'enriching')
          await this.repo.update(candidateId, { progressLogs: [] })

          const github = await this.githubApi.enrichGitHub(parsed.links.github, async (msg) => {
            this.logger.debug(`[Worker] Progress: ${msg}`)
            await this.appendProgress(candidateId, msg)
          })
          enrichment = { github, linkedin: null }
          await this.repo.update(candidateId, { enrichment, status: 'enriched' as CandidateStatus })
          this.logger.log(
            `[Worker] GitHub done: ${github ? `@${github.username}, ${github.repositories.length} repos` : 'no data'}`
          )
        } else {
          this.logger.log(`[Worker] Step 2/3: No GitHub link — skipping`)
          await this.repo.update(candidateId, { enrichment, status: 'enriched' as CandidateStatus })
        }
        await job.updateProgress(60)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        this.logger.warn(`[Worker] GitHub enrichment FAILED (skipping): ${errMsg}`)
        await this.repo.update(candidateId, {
          enrichment,
          errorMessage: `GitHub enrichment skipped: ${errMsg}`,
          status: 'enriched' as CandidateStatus,
        })
        await job.updateProgress(60)
      }

      // Step 3: AI Scoring (immediate — with GitHub data, no waiting for TinyFish)
      this.logger.log(`[Worker] Step 3/3: Scoring (github: ${!!enrichment.github})`)
      await this.updateStatus(candidateId, 'scoring')

      const updatedCandidate = await this.repo.findOne({ where: { id: candidateId } })
      const matchResult = await this.matching.score(
        { cvText: parsed.rawText, parsedCV: updatedCandidate?.parsedCV || null, enrichment },
        {
          description: jobDescription,
          requirements: jobRequirements,
          screeningCriteria: jobScreeningCriteria,
        }
      )
      await this.repo.update(candidateId, { matchResult, status: 'completed' as CandidateStatus })
      await job.updateProgress(100)

      this.logger.log(
        `[Worker] ${candidateId} COMPLETED: score=${matchResult.overallScore}/100 (github: ${!!enrichment.github})`
      )

      // LinkedIn and other TinyFish enrichments are on-demand — user triggers them from the UI
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Worker] FAILED ${candidateId}: ${errMsg}`)
      await this.repo.update(candidateId, {
        status: 'error' as CandidateStatus,
        errorMessage: errMsg,
      })
      throw err
    }
  }

  /** Re-enrich only: GitHub API (immediate) → re-score */
  private async processEnrichAndScore(job: Job<CandidateJobData>): Promise<void> {
    const { candidateId, jobDescription, jobRequirements, jobScreeningCriteria } = job.data
    this.logger.log(`[Worker] Re-enrich + re-score for ${candidateId}`)

    const candidate = await this.repo.findOne({ where: { id: candidateId } })
    if (!candidate) {
      this.logger.error(`[Worker] Candidate ${candidateId} not found`)
      return
    }

    try {
      // Step 1: Re-enrich GitHub (immediate)
      this.logger.log(`[Worker] Re-enriching GitHub: ${candidate.links.github || 'none'}`)
      await this.repo.update(candidateId, {
        status: 'enriching' as CandidateStatus,
        errorMessage: null,
        progressLogs: [],
      })

      let github = null
      if (candidate.links.github) {
        github = await this.githubApi.enrichGitHub(candidate.links.github, async (msg) => {
          this.logger.debug(`[Worker] Progress: ${msg}`)
          await this.appendProgress(candidateId, msg)
        })
      }

      const currentEnrichment =
        (candidate.enrichment as import('@lotushack/shared').EnrichedProfile) || {
          github: null,
          linkedin: null,
        }
      const enrichment = { ...currentEnrichment, github }
      await this.repo.update(candidateId, { enrichment, status: 'enriched' as CandidateStatus })
      await job.updateProgress(50)

      this.logger.log(
        `[Worker] Re-enrichment done: ${github ? `GitHub: @${github.username}` : 'no GitHub data'}`
      )

      // Step 2: Re-score
      this.logger.log(`[Worker] Re-scoring with enrichment data`)
      await this.repo.update(candidateId, { status: 'scoring' as CandidateStatus })

      const matchResult = await this.matching.score(
        { cvText: candidate.cvText, parsedCV: candidate.parsedCV, enrichment },
        {
          description: jobDescription,
          requirements: jobRequirements,
          screeningCriteria: jobScreeningCriteria,
        }
      )
      await this.repo.update(candidateId, { matchResult, status: 'completed' as CandidateStatus })
      await job.updateProgress(100)

      this.logger.log(`[Worker] ${candidateId} RE-SCORED: score=${matchResult.overallScore}/100`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Worker] Re-enrich FAILED ${candidateId}: ${errMsg}`)
      await this.repo.update(candidateId, {
        status: 'completed' as CandidateStatus,
        errorMessage: `Re-enrich failed: ${errMsg}`,
      })
      throw err
    }
  }

  /** Extended enrichment: runs ONE type per job (each type is queued independently) */
  private async processExtendedEnrich(job: Job<CandidateJobData>): Promise<void> {
    const {
      candidateId,
      extendedEnrichTypes,
      jobDescription,
      jobRequirements,
      jobScreeningCriteria,
    } = job.data
    const types = (extendedEnrichTypes || []) as ExtendedEnrichmentType[]
    const type = types[0] // Each job handles exactly one type
    if (!type) return

    this.logger.log(`[Worker] Extended enrich [${type}] for ${candidateId}`)

    const candidate = await this.repo.findOne({ where: { id: candidateId } })
    if (!candidate) return

    try {
      // Mark this type as running
      await this.updateEnrichmentProgress(candidateId, type, { status: 'running', logs: [] })

      // Gather URLs for enrichment
      const portfolioUrls = candidate.links.portfolio || []
      const blogUrls = portfolioUrls.filter((u) => /dev\.to|medium\.com|hashnode|blog/i.test(u))
      const stackoverflowUrl = portfolioUrls.find((u) => /stackoverflow\.com/i.test(u)) || null

      // Get project URLs from GitHub repos (if available)
      let projectUrls: string[] = []
      if (candidate.enrichment) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gh = (candidate.enrichment as any)?.github
        if (gh?.raw) {
          try {
            const rawData = JSON.parse(gh.raw as string)
            if (rawData.topProjects) {
              projectUrls = rawData.topProjects
                .filter((p: Record<string, unknown>) => p.url)
                .map((p: Record<string, unknown>) => String(p.url))
                .slice(0, 3)
            }
          } catch {
            /* ok */
          }
        }
      }
      const appUrls = portfolioUrls.filter(
        (u) =>
          !blogUrls.includes(u) && !stackoverflowUrl?.includes(u) && !/linkedin|github/i.test(u)
      )
      projectUrls = [...new Set([...projectUrls, ...appUrls])].slice(0, 3)

      const result = await this.extendedEnrichment.enrich(
        [type],
        {
          linkedinUrl: candidate.links.linkedin,
          portfolioUrls: portfolioUrls.filter(
            (u) => !blogUrls.includes(u) && !/stackoverflow/i.test(u)
          ),
          projectUrls,
          blogUrls,
          stackoverflowUrl,
          parsedCV: candidate.parsedCV as import('@lotushack/shared').ParsedCVData | null,
        },
        candidate.extendedEnrichment as import('@lotushack/shared').ExtendedEnrichment | null,
        async (msg) => {
          this.logger.debug(`[Worker] [${type}] ${msg}`)
          await this.appendEnrichmentLog(candidateId, type, msg)
        }
      )

      // Save results
      const updateData: Record<string, unknown> = {}

      // If LinkedIn was enriched, merge it into the main enrichment field
      if (result._linkedin !== undefined) {
        const currentEnrichment =
          (candidate.enrichment as import('@lotushack/shared').EnrichedProfile) || {
            github: null,
            linkedin: null,
          }
        updateData.enrichment = { ...currentEnrichment, linkedin: result._linkedin }
        this.logger.log(
          `[Worker] LinkedIn enrichment saved: ${result._linkedin?.headline || 'no headline'}`
        )
        delete result._linkedin
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateData.extendedEnrichment = result as any
      await this.repo.update(candidateId, updateData)

      // Mark this type as completed
      await this.updateEnrichmentProgress(candidateId, type, { status: 'completed', logs: [] })
      await job.updateProgress(80)

      // Re-score with latest data
      this.logger.log(`[Worker] Re-scoring after [${type}] enrichment`)
      const refreshed = await this.repo.findOne({ where: { id: candidateId } })
      if (refreshed) {
        const matchResult = await this.matching.score(
          {
            cvText: refreshed.cvText,
            parsedCV: refreshed.parsedCV,
            enrichment: refreshed.enrichment as import('@lotushack/shared').EnrichedProfile | null,
          },
          {
            description: jobDescription,
            requirements: jobRequirements,
            screeningCriteria: jobScreeningCriteria,
          }
        )
        await this.repo.update(candidateId, { matchResult })
      }
      await job.updateProgress(100)

      this.logger.log(`[Worker] Extended enrich [${type}] COMPLETED for ${candidateId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Worker] Extended enrich [${type}] FAILED ${candidateId}: ${errMsg}`)
      await this.updateEnrichmentProgress(candidateId, type, {
        status: 'error',
        logs: [],
        error: errMsg,
      })
    }
  }

  private async updateStatus(id: string, status: CandidateStatus) {
    this.logger.debug(`[Worker] ${id} → ${status}`)
    await this.repo.update(id, { status })
  }

  private async appendProgress(id: string, msg: string) {
    const candidate = await this.repo.findOne({ where: { id }, select: ['id', 'progressLogs'] })
    if (!candidate) return
    const logs = candidate.progressLogs || []
    logs.push(msg)
    if (logs.length > 50) logs.splice(0, logs.length - 50)
    await this.repo.update(id, { progressLogs: logs })
  }

  private async updateEnrichmentProgress(
    id: string,
    type: string,
    update: import('@lotushack/shared').EnrichmentJobStatus
  ) {
    const candidate = await this.repo.findOne({
      where: { id },
      select: ['id', 'enrichmentProgress'],
    })
    if (!candidate) return
    const progress = candidate.enrichmentProgress || {}
    // Preserve existing logs if only updating status
    if (update.logs.length === 0 && progress[type]?.logs?.length) {
      update.logs = progress[type].logs
    }
    progress[type] = update
    await this.repo.update(id, { enrichmentProgress: progress })
  }

  private async appendEnrichmentLog(id: string, type: string, msg: string) {
    const candidate = await this.repo.findOne({
      where: { id },
      select: ['id', 'enrichmentProgress'],
    })
    if (!candidate) return
    const progress = candidate.enrichmentProgress || {}
    if (!progress[type]) progress[type] = { status: 'running', logs: [] }
    progress[type].logs.push(msg)
    if (progress[type].logs.length > 30)
      progress[type].logs.splice(0, progress[type].logs.length - 30)
    await this.repo.update(id, { enrichmentProgress: progress })
  }
}
