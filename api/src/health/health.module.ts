import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { RedisHealthIndicator } from './redis.health'
import { MinioHealthIndicator } from './minio.health'

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, MinioHealthIndicator],
})
export class HealthModule {}
