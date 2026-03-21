import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name)
  private client!: Minio.Client
  private bucket!: string

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.bucket = this.config.get('MINIO_BUCKET', 'cvs')
    const endpoint = this.config.get('MINIO_ENDPOINT', 'localhost')
    const port = Number(this.config.get('MINIO_PORT', 9000))

    this.logger.log(`Connecting to MinIO: ${endpoint}:${port}, bucket=${this.bucket}`)

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL: false,
      accessKey: this.config.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get('MINIO_SECRET_KEY', 'minioadmin'),
    })

    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket)
      this.logger.log(`Created bucket: ${this.bucket}`)
    } else {
      this.logger.log(`Bucket exists: ${this.bucket}`)
    }
  }

  async upload(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    this.logger.debug(
      `Uploading ${fileName} (${(buffer.length / 1024).toFixed(1)}KB, ${contentType})`
    )
    await this.client.putObject(this.bucket, fileName, buffer, buffer.length, {
      'Content-Type': contentType,
    })
    const url = `${this.bucket}/${fileName}`
    this.logger.log(`Uploaded: ${url}`)
    return url
  }

  async getUrl(fileName: string): Promise<string> {
    this.logger.debug(`Generating presigned URL for ${fileName}`)
    return this.client.presignedGetObject(this.bucket, fileName, 3600)
  }
}
