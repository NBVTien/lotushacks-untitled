import { Injectable } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly host: string
  private readonly port: number

  constructor(private readonly config: ConfigService) {
    super()
    this.host = this.config.get('REDIS_HOST', 'localhost')
    this.port = Number(this.config.get('REDIS_PORT', 6379))
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    let client: Redis | undefined
    try {
      client = new Redis({
        host: this.host,
        port: this.port,
        connectTimeout: 3000,
        lazyConnect: true,
      })
      await client.connect()
      const pong = await client.ping()
      if (pong !== 'PONG') {
        throw new Error(`Unexpected ping response: ${pong}`)
      }
      return this.getStatus(key, true)
    } catch (error) {
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { message: (error as Error).message }))
    } finally {
      if (client) {
        try {
          await client.quit()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }
}
