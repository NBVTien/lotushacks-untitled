import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CompanyEntity, UserEntity, JobEntity, CandidateEntity } from '../database'
import { SeedService } from './seed.service'

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, UserEntity, JobEntity, CandidateEntity])],
  providers: [SeedService],
})
export class SeedModule {}
