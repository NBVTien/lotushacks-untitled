import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common'
import { Response } from 'express'
import { DiscoveryService } from './discovery.service'
import { CandidatesService } from '../candidates/candidates.service'
import { JobsService } from '../jobs/jobs.service'
import type {
  JobDiscoveryRequest,
  SourcingRequest,
  ParsedCVData,
} from '@lotushack/shared'

@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly candidatesService: CandidatesService,
    private readonly jobsService: JobsService,
  ) {}

  // ─── Feature C: Job Discovery ───────────────────────────────────────

  @Post('jobs')
  async discoverJobs(@Body() body: JobDiscoveryRequest) {
    return this.discoveryService.discoverJobs(body)
  }

  @Post('jobs-from-cv')
  async discoverJobsFromCv(@Body() body: { candidateId: string }) {
    const candidate = await this.candidatesService.findOne(body.candidateId)
    if (!candidate) {
      throw new NotFoundException(`Candidate ${body.candidateId} not found`)
    }

    const parsedCV = candidate.parsedCV as unknown as ParsedCVData | null
    const request: JobDiscoveryRequest = {
      skills: parsedCV?.skills || [],
      experience: parsedCV?.experience?.map((e) => `${e.title} at ${e.company}`) || [],
      location: null,
      title: parsedCV?.experience?.[0]?.title || null,
    }

    return this.discoveryService.discoverJobs(request)
  }

  /** SSE endpoint — streams job discovery progress in real-time */
  @Get('jobs/:candidateId/stream')
  async jobDiscoveryStream(
    @Param('candidateId') candidateId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const candidate = await this.candidatesService.findOne(candidateId)
    if (!candidate) {
      res.write(`data: ${JSON.stringify({ error: 'Candidate not found' })}\n\n`)
      res.end()
      return
    }

    const parsedCV = candidate.parsedCV as unknown as ParsedCVData | null
    const request: JobDiscoveryRequest = {
      skills: parsedCV?.skills || [],
      experience: parsedCV?.experience?.map((e) => `${e.title} at ${e.company}`) || [],
      location: null,
      title: parsedCV?.experience?.[0]?.title || null,
    }

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      const result = await this.discoveryService.discoverJobs(request, onProgress)
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }

  // ─── Feature D: Company Research ────────────────────────────────────

  @Post('company-research')
  async researchCompany(@Body() body: { companyName: string; companyUrl?: string }) {
    return this.discoveryService.researchCompany(body.companyName, body.companyUrl)
  }

  // ─── Feature A: Candidate Sourcing ──────────────────────────────────

  @Post('source-candidates')
  async sourceCandidates(@Body() body: SourcingRequest) {
    return this.discoveryService.sourceCandidates(body)
  }

  @Post('source-from-job')
  async sourceFromJob(@Body() body: { jobId: string }) {
    const job = await this.jobsService.findOne(body.jobId)
    if (!job) {
      throw new NotFoundException(`Job ${body.jobId} not found`)
    }

    const request: SourcingRequest = {
      jobTitle: job.title,
      skills: job.requirements || [],
      location: null,
      experience: null,
    }

    return this.discoveryService.sourceCandidates(request)
  }
}
