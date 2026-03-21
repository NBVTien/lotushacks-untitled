import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Job } from 'bullmq'
import { CandidateEntity } from '../database'
import { PdfService } from './pdf.service'
import { MinioService } from './minio.service'
import { EnrichmentService } from '../enrichment/enrichment.service'
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
    private readonly enrichment: EnrichmentService,
    private readonly extendedEnrichment: ExtendedEnrichmentService,
    private readonly matching: MatchingService,
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
    const { candidateId, cvFileName, jobDescription, jobRequirements, jobScreeningCriteria, overrideName, overrideEmail } = job.data
    this.logger.log(`[Worker] Full pipeline for ${candidateId} (job: ${job.id}, attempt: ${job.attemptsMade + 1})`)

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
      this.logger.log(`[Worker] CV parsed: name="${overrideName || parsed.name}", skills=${parsed.skills.length}, exp=${parsed.experience.length}`)

      // Step 2: Enrichment (skippable on failure)
      let enrichment = null
      try {
        this.logger.log(`[Worker] Step 2/3: Enriching (GitHub: ${parsed.links.github || 'none'}, LinkedIn: ${parsed.links.linkedin || 'none'})`)
        await this.updateStatus(candidateId, 'enriching')
        await this.repo.update(candidateId, { progressLogs: [] })

        enrichment = await this.enrichment.enrich(parsed.links, async (msg) => {
          this.logger.debug(`[Worker] Progress: ${msg}`)
          await this.appendProgress(candidateId, msg)
        })
        await this.repo.update(candidateId, { enrichment, status: 'enriched' as CandidateStatus })
        await job.updateProgress(60)

        const enrichSummary = [
          enrichment.github ? `GitHub: @${enrichment.github.username}, ${enrichment.github.repositories.length} repos` : null,
          enrichment.linkedin ? `LinkedIn: ${enrichment.linkedin.headline || 'found'}` : null,
        ].filter(Boolean).join(' | ')
        this.logger.log(`[Worker] Enrichment done: ${enrichSummary || 'no external data'}`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        this.logger.warn(`[Worker] Enrichment FAILED (skipping): ${errMsg}`)
        await this.repo.update(candidateId, {
          enrichment: null,
          errorMessage: `Enrichment skipped: ${errMsg}`,
          status: 'enriched' as CandidateStatus,
        })
        await job.updateProgress(60)
      }

      // Step 3: AI Scoring (always runs, with or without enrichment)
      this.logger.log(`[Worker] Step 3/3: Scoring (enriched: ${!!enrichment?.github || !!enrichment?.linkedin})`)
      await this.updateStatus(candidateId, 'scoring')

      const updatedCandidate = await this.repo.findOne({ where: { id: candidateId } })
      const matchResult = await this.matching.score(
        { cvText: parsed.rawText, parsedCV: updatedCandidate?.parsedCV || null, enrichment },
        { description: jobDescription, requirements: jobRequirements, screeningCriteria: jobScreeningCriteria },
      )
      await this.repo.update(candidateId, { matchResult, status: 'completed' as CandidateStatus })
      await job.updateProgress(100)

      this.logger.log(`[Worker] ${candidateId} COMPLETED: score=${matchResult.overallScore}/100 (enriched: ${!!enrichment?.github || !!enrichment?.linkedin})`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Worker] FAILED ${candidateId}: ${errMsg}`)
      await this.repo.update(candidateId, { status: 'error' as CandidateStatus, errorMessage: errMsg })
      throw err
    }
  }

  /** Re-enrich only: fetch TinyFish data → re-score */
  private async processEnrichAndScore(job: Job<CandidateJobData>): Promise<void> {
    const { candidateId, jobDescription, jobRequirements, jobScreeningCriteria } = job.data
    this.logger.log(`[Worker] Re-enrich + re-score for ${candidateId}`)

    const candidate = await this.repo.findOne({ where: { id: candidateId } })
    if (!candidate) {
      this.logger.error(`[Worker] Candidate ${candidateId} not found`)
      return
    }

    try {
      // Step 1: Re-enrich
      this.logger.log(`[Worker] Re-enriching (GitHub: ${candidate.links.github || 'none'}, LinkedIn: ${candidate.links.linkedin || 'none'})`)
      await this.repo.update(candidateId, { status: 'enriching' as CandidateStatus, errorMessage: null, progressLogs: [] })

      const enrichment = await this.enrichment.enrich(candidate.links, async (msg) => {
        this.logger.debug(`[Worker] Progress: ${msg}`)
        await this.appendProgress(candidateId, msg)
      })
      await this.repo.update(candidateId, { enrichment, status: 'enriched' as CandidateStatus })
      await job.updateProgress(50)

      const enrichSummary = [
        enrichment.github ? `GitHub: @${enrichment.github.username}, ${enrichment.github.repositories.length} repos` : null,
        enrichment.linkedin ? `LinkedIn: ${enrichment.linkedin.headline || 'found'}` : null,
      ].filter(Boolean).join(' | ')
      this.logger.log(`[Worker] Re-enrichment done: ${enrichSummary || 'no data'}`)

      // Step 2: Re-score with enrichment data
      this.logger.log(`[Worker] Re-scoring with enrichment data`)
      await this.repo.update(candidateId, { status: 'scoring' as CandidateStatus })

      const matchResult = await this.matching.score(
        { cvText: candidate.cvText, parsedCV: candidate.parsedCV, enrichment },
        { description: jobDescription, requirements: jobRequirements, screeningCriteria: jobScreeningCriteria },
      )
      await this.repo.update(candidateId, { matchResult, status: 'completed' as CandidateStatus })
      await job.updateProgress(100)

      this.logger.log(`[Worker] ${candidateId} RE-SCORED: score=${matchResult.overallScore}/100`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Worker] Re-enrich FAILED ${candidateId}: ${errMsg}`)
      await this.repo.update(candidateId, { status: 'completed' as CandidateStatus, errorMessage: `Re-enrich failed: ${errMsg}` })
      throw err
    }
  }

  /** Extended enrichment: portfolio, live projects, blog, SO, verification */
  private async processExtendedEnrich(job: Job<CandidateJobData>): Promise<void> {
    const { candidateId, extendedEnrichTypes, jobDescription, jobRequirements, jobScreeningCriteria } = job.data
    const types = (extendedEnrichTypes || []) as ExtendedEnrichmentType[]
    this.logger.log(`[Worker] Extended enrich for ${candidateId}: ${types.join(', ')}`)

    const candidate = await this.repo.findOne({ where: { id: candidateId } })
    if (!candidate) return

    try {
      await this.repo.update(candidateId, { status: 'enriching' as CandidateStatus, progressLogs: [] })

      // Gather URLs for enrichment
      const portfolioUrls = candidate.links.portfolio || []
      const blogUrls = portfolioUrls.filter((u) =>
        /dev\.to|medium\.com|hashnode|blog/i.test(u),
      )
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
          } catch { /* ok */ }
        }
      }
      // Also check portfolio URLs that look like apps
      const appUrls = portfolioUrls.filter((u) =>
        !blogUrls.includes(u) && !stackoverflowUrl?.includes(u) && !/linkedin|github/i.test(u),
      )
      projectUrls = [...new Set([...projectUrls, ...appUrls])].slice(0, 3)

      const result = await this.extendedEnrichment.enrich(
        types,
        {
          portfolioUrls: portfolioUrls.filter((u) => !blogUrls.includes(u) && !/stackoverflow/i.test(u)),
          projectUrls,
          blogUrls,
          stackoverflowUrl,
          parsedCV: candidate.parsedCV as import('@lotushack/shared').ParsedCVData | null,
        },
        candidate.extendedEnrichment as import('@lotushack/shared').ExtendedEnrichment | null,
        async (msg) => {
          this.logger.debug(`[Worker] Extended: ${msg}`)
          await this.appendProgress(candidateId, msg)
        },
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.repo.update(candidateId, { extendedEnrichment: result as any })
      await job.updateProgress(70)

      // Re-score with extended data
      this.logger.log(`[Worker] Re-scoring with extended enrichment data`)
      await this.updateStatus(candidateId, 'scoring')

      const matchResult = await this.matching.score(
        { cvText: candidate.cvText, parsedCV: candidate.parsedCV, enrichment: candidate.enrichment as import('@lotushack/shared').EnrichedProfile | null },
        { description: jobDescription, requirements: jobRequirements, screeningCriteria: jobScreeningCriteria },
      )
      await this.repo.update(candidateId, { matchResult, status: 'completed' as CandidateStatus })
      await job.updateProgress(100)

      this.logger.log(`[Worker] Extended enrich COMPLETED for ${candidateId}: score=${matchResult.overallScore}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Worker] Extended enrich FAILED ${candidateId}: ${errMsg}`)
      await this.repo.update(candidateId, { status: 'completed' as CandidateStatus, errorMessage: `Extended enrich failed: ${errMsg}` })
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
    // Keep last 50 logs
    if (logs.length > 50) logs.splice(0, logs.length - 50)
    await this.repo.update(id, { progressLogs: logs })
  }
}
