import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CompanyEntity, UserEntity, JobEntity } from '../database'
import { SeedService } from './seed.service'

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, UserEntity, JobEntity])],
  providers: [SeedService],
})
export class SeedModule {}
