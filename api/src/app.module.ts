import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { BullBoardModule } from '@bull-board/nestjs'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import {
  CompanyEntity,
  UserEntity,
  JobEntity,
  CandidateEntity,
  SourcingResultEntity,
} from './database'
import { AuthModule } from './auth/auth.module'
import { JobsModule } from './jobs/jobs.module'
import { CandidatesModule } from './candidates/candidates.module'
import { EnrichmentModule } from './enrichment/enrichment.module'
import { MatchingModule } from './matching/matching.module'
import { SeedModule } from './seed/seed.module'
import { DiscoveryModule } from './discovery/discovery.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'postgres'),
        password: config.get('DATABASE_PASSWORD', 'postgres'),
        database: config.get('DATABASE_NAME', 'recruitment'),
        entities: [CompanyEntity, UserEntity, JobEntity, CandidateEntity, SourcingResultEntity],
        synchronize: true,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'candidate-processing',
      adapter: BullMQAdapter,
    }),
    AuthModule,
    JobsModule,
    CandidatesModule,
    EnrichmentModule,
    MatchingModule,
    SeedModule,
    DiscoveryModule,
    HealthModule,
  ],
})
export class AppModule {}
