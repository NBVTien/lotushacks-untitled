/**
 * Standalone seed script — run with: npm run seed (from api/ directory)
 *
 * This bootstraps the NestJS app, which triggers SeedService.onModuleInit()
 * to populate the database with demo data, then shuts down.
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function runSeed() {
  console.log('Starting seed...')
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  })

  // SeedService.onModuleInit() runs automatically during bootstrap.
  // It checks for existing data and is idempotent.

  await app.close()
  console.log('Seed script finished.')
}

runSeed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
