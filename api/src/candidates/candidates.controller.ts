import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CandidatesService } from './candidates.service'

@Controller('jobs/:jobId/candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('cv'))
  upload(
    @Param('jobId') jobId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('email') email?: string
  ) {
    return this.candidatesService.upload(jobId, file, { name, email })
  }

  @Get()
  findByJob(@Param('jobId') jobId: string) {
    return this.candidatesService.findByJob(jobId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id)
  }

  @Get(':id/cv-url')
  getCvUrl(@Param('id') id: string) {
    return this.candidatesService.getCvUrl(id)
  }

  /** SSE endpoint — streams enrichmentProgress changes in real-time */
  @Get(':id/enrichment-stream')
  async enrichmentStream(@Param('id') id: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    let lastSnapshot = ''
    let idleCount = 0

    const interval = setInterval(async () => {
      try {
        const candidate = await this.candidatesService.findOne(id)
        const snapshot = JSON.stringify({
          enrichmentProgress: candidate.enrichmentProgress || {},
          enrichment: candidate.enrichment,
          extendedEnrichment: candidate.extendedEnrichment,
          matchResult: candidate.matchResult,
          status: candidate.status,
          progressLogs: candidate.progressLogs,
        })

        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot
          idleCount = 0
          res.write(`data: ${snapshot}\n\n`)
        } else {
          idleCount++
          // Send heartbeat every 15s (idleCount * 1s interval)
          if (idleCount % 15 === 0) {
            res.write(`: heartbeat\n\n`)
          }
          // Close after 5 minutes of no changes
          if (idleCount > 300) {
            res.write(`data: {"done":true}\n\n`)
            clearInterval(interval)
            res.end()
          }
        }
      } catch {
        clearInterval(interval)
        res.end()
      }
    }, 1000)

    res.on('close', () => {
      clearInterval(interval)
    })
  }

  @Post(':id/retry')
  retry(@Param('jobId') jobId: string, @Param('id') id: string) {
    return this.candidatesService.retry(jobId, id)
  }

  @Post(':id/re-enrich')
  reEnrich(@Param('jobId') jobId: string, @Param('id') id: string) {
    return this.candidatesService.reEnrich(jobId, id)
  }

  @Post(':id/extended-enrich')
  extendedEnrich(
    @Param('jobId') jobId: string,
    @Param('id') id: string,
    @Body('types') types: string[]
  ) {
    return this.candidatesService.extendedEnrich(jobId, id, types)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/interview-questions')
  generateInterviewQuestions(@Param('jobId') jobId: string, @Param('id') id: string) {
    return this.candidatesService.generateInterviewQuestions(jobId, id)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.candidatesService.delete(id)
  }
}
