import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { CandidateEntity } from '../database'
import type { CandidateStatus } from '@lotushack/shared'

@Injectable()
export class StartupService implements OnModuleInit {
  private readonly logger = new Logger(StartupService.name)

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly repo: Repository<CandidateEntity>
  ) {}

  async onModuleInit() {
    // Reset candidates stuck in processing states (from server crash/restart)
    const stuckStatuses: CandidateStatus[] = [
      'uploaded',
      'parsed',
      'enriching',
      'enriched',
      'scoring',
    ]
    const stuck = await this.repo.find({
      where: { status: In(stuckStatuses) },
    })

    if (stuck.length > 0) {
      this.logger.warn(`Found ${stuck.length} candidates stuck in processing — resetting to error`)
      for (const candidate of stuck) {
        await this.repo.update(candidate.id, {
          status: 'error' as CandidateStatus,
          errorMessage: 'Processing interrupted by server restart. Click retry to re-process.',
        })
        this.logger.log(`Reset stuck candidate ${candidate.id} (was: ${candidate.status})`)
      }
    }
  }
}
