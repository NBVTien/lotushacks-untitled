import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MulterModule } from '@nestjs/platform-express'
import { UserEntity, SavedJdEntity } from '../database'
import { CandidatePortalController } from './candidate-portal.controller'
import { CandidatePortalService } from './candidate-portal.service'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { MatchingModule } from '../matching/matching.module'
import { CandidatesModule } from '../candidates/candidates.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SavedJdEntity]),
    MulterModule.register({ storage: undefined }),
    EnrichmentModule,
    MatchingModule,
    CandidatesModule,
  ],
  controllers: [CandidatePortalController],
  providers: [CandidatePortalService],
})
export class CandidatePortalModule {}
