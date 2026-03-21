import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JobEntity, CandidateEntity } from '../database'
import type { CreateJobDto } from '@lotushack/shared'

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    @InjectRepository(JobEntity)
    private readonly repo: Repository<JobEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>
  ) {}

  async create(dto: CreateJobDto, companyId: string) {
    this.logger.log(
      `Creating job: title="${dto.title}", companyId=${companyId}, requirements=${dto.requirements.length}`
    )
    const job = this.repo.create({ ...dto, companyId })
    const saved = await this.repo.save(job)
    this.logger.log(`Job created: id=${saved.id}`)
    return saved
  }

  async findByCompany(companyId: string) {
    this.logger.debug(`Listing jobs for company ${companyId}`)
    const jobs = await this.repo.find({
      where: { companyId },
      relations: ['company'],
      order: { createdAt: 'DESC' },
    })
    if (jobs.length === 0) return jobs
    const counts = await this.candidateRepo
      .createQueryBuilder('c')
      .select('c.jobId', 'jobId')
      .addSelect('COUNT(*)', 'count')
      .where('c.jobId IN (:...ids)', { ids: jobs.map((j) => j.id) })
      .groupBy('c.jobId')
      .getRawMany<{ jobId: string; count: string }>()
    const countMap = Object.fromEntries(counts.map((r) => [r.jobId, Number(r.count)]))
    return jobs.map((j) => ({ ...j, candidateCount: countMap[j.id] ?? 0 }))
  }

  async findAllPublic(page: number, limit: number) {
    const [data, total] = await this.repo.findAndCount({
      where: { isActive: true },
      relations: ['company'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return { data, total, hasMore: page * limit < total }
  }

  async findOne(id: string) {
    const job = await this.repo.findOne({
      where: { id },
      relations: ['candidates', 'company'],
    })
    if (!job) throw new NotFoundException('Job not found')
    return job
  }

  async update(id: string, dto: Partial<CreateJobDto>) {
    this.logger.log(`Updating job ${id}: ${Object.keys(dto).join(', ')}`)
    await this.repo.update(id, dto)
    return this.findOne(id)
  }

  async toggleActive(id: string, isActive: boolean) {
    this.logger.log(`Toggling job ${id}: isActive=${isActive}`)
    await this.repo.update(id, { isActive })
    return this.findOne(id)
  }

  async delete(id: string) {
    this.logger.log(`Deleting job ${id}`)
    await this.repo.delete(id)
  }

  async getStats(companyId: string) {
    this.logger.debug(`Getting stats for company ${companyId}`)

    // Job counts
    const jobs = await this.repo.find({ where: { companyId } })
    const totalJobs = jobs.length
    const activeJobs = jobs.filter((j) => j.isActive).length
    const jobIds = jobs.map((j) => j.id)

    if (jobIds.length === 0) {
      return {
        totalJobs: 0,
        activeJobs: 0,
        totalCandidates: 0,
        avgScore: 0,
        pipelineBreakdown: {
          uploaded: 0,
          parsed: 0,
          enriching: 0,
          scoring: 0,
          completed: 0,
        },
        recommendationBreakdown: {
          strong_match: 0,
          good_match: 0,
          partial_match: 0,
          weak_match: 0,
        },
      }
    }

    // Get all candidates for this company's jobs
    const candidates = await this.candidateRepo
      .createQueryBuilder('c')
      .where('c.jobId IN (:...jobIds)', { jobIds })
      .getMany()

    const totalCandidates = candidates.length

    // Average score from matchResult
    const scores = candidates
      .filter((c) => c.matchResult?.overallScore != null)
      .map((c) => c.matchResult!.overallScore)
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0

    // Pipeline breakdown
    const pipelineBreakdown = {
      uploaded: 0,
      parsed: 0,
      enriching: 0,
      scoring: 0,
      completed: 0,
    }
    for (const c of candidates) {
      if (c.status in pipelineBreakdown) {
        pipelineBreakdown[c.status as keyof typeof pipelineBreakdown]++
      }
    }

    // Recommendation breakdown
    const recommendationBreakdown = {
      strong_match: 0,
      good_match: 0,
      partial_match: 0,
      weak_match: 0,
    }
    for (const c of candidates) {
      const rec = c.matchResult?.recommendation
      if (rec && rec in recommendationBreakdown) {
        recommendationBreakdown[rec as keyof typeof recommendationBreakdown]++
      }
    }

    return {
      totalJobs,
      activeJobs,
      totalCandidates,
      avgScore,
      pipelineBreakdown,
      recommendationBreakdown,
    }
  }
}
