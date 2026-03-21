import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { MulterModule } from '@nestjs/platform-express'
import { CandidateEntity } from '../database'
import { CandidatesController } from './candidates.controller'
import { CandidatesService } from './candidates.service'
import { CandidateProcessor } from './candidate.processor'
import { MinioService } from './minio.service'
import { PdfService } from './pdf.service'
import { StartupService } from './startup.service'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { MatchingModule } from '../matching/matching.module'
import { JobsModule } from '../jobs/jobs.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateEntity]),
    BullModule.registerQueue({ name: 'candidate-processing' }),
    MulterModule.register({ storage: undefined }),
    EnrichmentModule,
    MatchingModule,
    JobsModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidateProcessor, MinioService, PdfService, StartupService],
})
export class CandidatesModule {}
