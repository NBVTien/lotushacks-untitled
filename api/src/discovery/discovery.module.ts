import { Module } from '@nestjs/common'
import { DiscoveryController } from './discovery.controller'
import { DiscoveryService } from './discovery.service'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { CandidatesModule } from '../candidates/candidates.module'
import { JobsModule } from '../jobs/jobs.module'

@Module({
  imports: [EnrichmentModule, CandidatesModule, JobsModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
