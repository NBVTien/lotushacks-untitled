import { Injectable } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'

@Injectable()
export class MinioHealthIndicator extends HealthIndicator {
  private readonly client: Minio.Client

  constructor(private readonly config: ConfigService) {
    super()
    this.client = new Minio.Client({
      endPoint: this.config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.config.get('MINIO_PORT', 9000)),
      useSSL: false,
      accessKey: this.config.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get('MINIO_SECRET_KEY', 'minioadmin'),
    })
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.client.listBuckets()
      return this.getStatus(key, true)
    } catch (error) {
      throw new HealthCheckError('MinIO check failed', this.getStatus(key, false, { message: (error as Error).message }))
    }
  }
}
