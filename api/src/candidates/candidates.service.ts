import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Repository } from 'typeorm'
import { Queue } from 'bullmq'
import { v4 as uuid } from 'uuid'
import { CandidateEntity } from '../database'
import { MinioService } from './minio.service'
import { JobsService } from '../jobs/jobs.service'
import { MatchingService } from '../matching/matching.service'
import type { CandidateStatus, PipelineStage, CandidateNote, PipelineHistoryEntry } from '@lotushack/shared'
import type { CandidateJobData } from './candidate.processor'

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name)

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly repo: Repository<CandidateEntity>,
    @InjectQueue('candidate-processing')
    private readonly queue: Queue<CandidateJobData>,
    private readonly minio: MinioService,
    private readonly jobs: JobsService,
    private readonly matching: MatchingService
  ) {}

  async upload(
    jobId: string,
    file: Express.Multer.File,
    overrides?: { name?: string; email?: string }
  ) {
    this.logger.log(
      `Upload started: jobId=${jobId}, file=${file.originalname}, size=${(file.size / 1024).toFixed(1)}KB`
    )

    const job = await this.jobs.findOne(jobId)

    // 1. Upload PDF to MinIO (fast, ~100ms)
    const fileName = `${uuid()}.pdf`
    const cvUrl = await this.minio.upload(fileName, file.buffer, file.mimetype)
    this.logger.log(`PDF stored: ${cvUrl}`)

    // 2. Create candidate record immediately with 'uploaded' status
    const candidate = this.repo.create({
      jobId: job.id,
      name: overrides?.name || file.originalname.replace('.pdf', ''),
      email: overrides?.email || null,
      cvUrl,
      status: 'uploaded' as CandidateStatus,
    })

    const saved = await this.repo.save(candidate)
    this.logger.log(`Candidate created: id=${saved.id}, name="${saved.name}", status=uploaded`)

    // 3. Queue ALL heavy processing (PDF parse → AI parse → enrich → score)
    const bullJob = await this.queue.add(
      'process',
      {
        candidateId: saved.id,
        cvFileName: fileName,
        jobDescription: job.description,
        jobRequirements: job.requirements,
        jobScreeningCriteria: job.screeningCriteria,
        overrideName: overrides?.name,
        overrideEmail: overrides?.email,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      }
    )
    this.logger.log(`Queued: candidateId=${saved.id}, bullmqJobId=${bullJob.id}`)

    return saved
  }

  async findByJob(jobId: string) {
    return this.repo.find({ where: { jobId }, order: { createdAt: 'DESC' } })
  }

  async findOne(id: string) {
    const candidate = await this.repo.findOne({ where: { id }, relations: ['job'] })
    if (!candidate) throw new NotFoundException('Candidate not found')
    return candidate
  }

  async retry(jobId: string, candidateId: string) {
    const candidate = await this.findOne(candidateId)
    const job = await this.jobs.findOne(jobId)

    if (candidate.retryCount >= 3) {
      this.logger.warn(
        `Retry limit reached for candidate ${candidateId} (${candidate.retryCount}/3)`
      )
      return { error: 'Maximum retry limit (3) reached' }
    }

    this.logger.log(`Retrying candidate ${candidateId} (attempt ${candidate.retryCount + 1}/3)`)

    await this.repo.update(candidateId, {
      status: 'uploaded' as CandidateStatus,
      errorMessage: null,
      retryCount: candidate.retryCount + 1,
    })

    const cvFileName = candidate.cvUrl.replace('cvs/', '')
    const bullJob = await this.queue.add(
      'process',
      {
        candidateId,
        cvFileName,
        jobDescription: job.description,
        jobRequirements: job.requirements,
        jobScreeningCriteria: job.screeningCriteria,
        overrideName: candidate.name,
        overrideEmail: candidate.email || undefined,
      },
      {
        attempts: 1,
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      }
    )
    this.logger.log(`Retry queued: candidateId=${candidateId}, bullmqJobId=${bullJob.id}`)

    return this.findOne(candidateId)
  }

  async reEnrich(jobId: string, candidateId: string) {
    const candidate = await this.findOne(candidateId)
    const job = await this.jobs.findOne(jobId)

    if (!candidate.links.github && !candidate.links.linkedin) {
      return { error: 'No GitHub or LinkedIn links found in CV' }
    }

    this.logger.log(
      `Re-enriching candidate ${candidateId} (GitHub: ${candidate.links.github || 'none'}, LinkedIn: ${candidate.links.linkedin || 'none'})`
    )

    const bullJob = await this.queue.add(
      'process',
      {
        candidateId,
        cvFileName: candidate.cvUrl.replace('cvs/', ''),
        jobDescription: job.description,
        jobRequirements: job.requirements,
        jobScreeningCriteria: job.screeningCriteria,
        enrichOnly: true,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      }
    )
    this.logger.log(`Re-enrich queued: candidateId=${candidateId}, bullmqJobId=${bullJob.id}`)

    return this.findOne(candidateId)
  }

  async extendedEnrich(
    jobId: string,
    candidateId: string,
    types: string[],
    options?: { companyUrl?: string; companyName?: string }
  ) {
    const candidate = await this.findOne(candidateId)
    const job = await this.jobs.findOne(jobId)

    this.logger.log(`Extended enrich for ${candidateId}: types=${types.join(', ')}`)

    // Set initial progress state for all types
    const progress = candidate.enrichmentProgress || {}
    for (const type of types) {
      progress[type] = { status: 'queued', logs: [] }
    }
    await this.repo.update(candidateId, { enrichmentProgress: progress })

    // Queue each type as a separate independent job
    for (const type of types) {
      const jobData: CandidateJobData = {
        candidateId,
        cvFileName: candidate.cvUrl.replace('cvs/', ''),
        jobDescription: job.description,
        jobRequirements: job.requirements,
        jobScreeningCriteria: job.screeningCriteria,
        extendedEnrichTypes: [type],
      }

      // Pass company URL/name for per-company enrichment
      if (type === 'companyIntel' && options?.companyUrl) {
        jobData.companyUrl = options.companyUrl
        jobData.companyName = options.companyName
      }

      const bullJob = await this.queue.add('process', jobData, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      })
      this.logger.log(
        `Extended enrich [${type}] queued: candidateId=${candidateId}, bullmqJobId=${bullJob.id}`
      )
    }

    return this.findOne(candidateId)
  }

  async getCvUrl(id: string) {
    const candidate = await this.findOne(id)
    const fileName = candidate.cvUrl.replace('cvs/', '')
    const url = await this.minio.getUrl(fileName)
    return { url }
  }

  async generateInterviewQuestions(jobId: string, candidateId: string) {
    const candidate = await this.findOne(candidateId)

    // Return cached result if available
    if (candidate.interviewQuestions) {
      this.logger.log(`Returning cached interview questions for candidate ${candidateId}`)
      return candidate.interviewQuestions
    }

    if (!candidate.matchResult) {
      throw new NotFoundException('Candidate has not been scored yet')
    }

    const job = await this.jobs.findOne(jobId)

    const result = await this.matching.generateInterviewQuestions(
      { cvText: candidate.cvText, matchResult: candidate.matchResult, enrichment: candidate.enrichment },
      { description: job.description, requirements: job.requirements }
    )

    // Cache the result
    await this.repo.update(candidateId, { interviewQuestions: result })
    this.logger.log(`Cached interview questions for candidate ${candidateId}`)

    return result
  }

  async updatePipelineStage(
    candidateId: string,
    jobId: string,
    stage: PipelineStage,
    changedBy: string
  ) {
    const candidate = await this.findOne(candidateId)
    if (candidate.jobId !== jobId) {
      throw new NotFoundException('Candidate not found for this job')
    }

    const historyEntry: PipelineHistoryEntry = {
      from: candidate.pipelineStage,
      to: stage,
      changedBy,
      changedAt: new Date().toISOString(),
    }

    const pipelineHistory = [...(candidate.pipelineHistory || []), historyEntry]

    await this.repo.update(candidateId, { pipelineStage: stage, pipelineHistory })
    this.logger.log(
      `Pipeline stage updated: candidate=${candidateId}, ${historyEntry.from} → ${stage}, by=${changedBy}`
    )

    return this.findOne(candidateId)
  }

  async addNote(candidateId: string, jobId: string, text: string, authorName: string) {
    const candidate = await this.findOne(candidateId)
    if (candidate.jobId !== jobId) {
      throw new NotFoundException('Candidate not found for this job')
    }

    const note: CandidateNote = {
      id: uuid(),
      text,
      authorName,
      createdAt: new Date().toISOString(),
    }

    const notes = [note, ...(candidate.notes || [])]
    await this.repo.update(candidateId, { notes })
    this.logger.log(`Note added: candidate=${candidateId}, by=${authorName}`)

    return this.findOne(candidateId)
  }

  async getCandidatesByStage(jobId: string): Promise<Record<PipelineStage, CandidateEntity[]>> {
    const candidates = await this.repo.find({
      where: { jobId, status: 'completed' as CandidateStatus },
      order: { createdAt: 'DESC' },
    })

    const stages: PipelineStage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']
    const grouped = {} as Record<PipelineStage, CandidateEntity[]>
    for (const stage of stages) {
      grouped[stage] = []
    }
    for (const candidate of candidates) {
      const stage = candidate.pipelineStage || 'new'
      grouped[stage].push(candidate)
    }

    return grouped
  }

  async delete(id: string) {
    this.logger.log(`Deleting candidate ${id}`)
    await this.repo.delete(id)
  }
}
