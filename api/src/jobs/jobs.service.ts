import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JobEntity } from '../database'
import type { CreateJobDto } from '@lotushack/shared'

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    @InjectRepository(JobEntity)
    private readonly repo: Repository<JobEntity>
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
    return this.repo.find({
      where: { companyId },
      relations: ['company'],
      order: { createdAt: 'DESC' },
    })
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
}
