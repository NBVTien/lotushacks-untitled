import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { DiscoveryService } from './discovery.service'
import { CandidatesService } from '../candidates/candidates.service'
import { JobsService } from '../jobs/jobs.service'
import { PdfService } from '../candidates/pdf.service'
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
    private readonly pdfService: PdfService,
  ) {}

  // ─── Feature C: Job Discovery ───────────────────────────────────────

  /** SSE endpoint — streams job discovery progress in real-time */
  @Post('jobs')
  async discoverJobs(@Body() body: JobDiscoveryRequest, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      const result = await this.discoveryService.discoverJobs(body, onProgress)
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
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

  /** SSE endpoint — upload CV, discover jobs, rank them with AI */
  @Post('jobs-from-upload')
  @UseInterceptors(FileInterceptor('cv'))
  async discoverJobsFromUpload(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      if (!file) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'No CV file uploaded' })}\n\n`)
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
        return
      }

      // Step 1: Parse the CV
      onProgress('Parsing your CV...')
      const parsedCV = await this.pdfService.parseCV(file.buffer, file.originalname)
      onProgress(`CV parsed: found ${parsedCV.skills.length} skills, ${parsedCV.experience.length} experiences`)

      // Step 2: Build discovery request from parsed CV
      const request: JobDiscoveryRequest = {
        skills: parsedCV.skills,
        experience: parsedCV.experience.map((e) => `${e.title} at ${e.company}`),
        location: null,
        title: parsedCV.experience?.[0]?.title || null,
      }

      // Step 3: Discover jobs
      const result = await this.discoveryService.discoverJobs(request, onProgress)

      // Step 4: Rank jobs against CV using AI
      const rankedJobs = await this.discoveryService.rankJobsByCv(
        result.jobs,
        parsedCV.rawText,
        parsedCV.skills,
        onProgress,
      )
      result.jobs = rankedJobs

      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
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

  // ─── Feature A: Candidate Sourcing (SSE streaming) ──────────────────

  /** SSE endpoint — streams sourcing progress + results in real-time */
  @Post('source-candidates')
  async sourceCandidatesStream(@Body() body: SourcingRequest, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      const result = await this.discoveryService.sourceCandidates(body, onProgress)
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }

  /** SSE endpoint — source from job requirements */
  @Post('source-from-job')
  async sourceFromJobStream(@Body() body: { jobId: string }, @Res() res: Response) {
    const job = await this.jobsService.findOne(body.jobId)
    if (!job) {
      throw new NotFoundException(`Job ${body.jobId} not found`)
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const request: SourcingRequest = {
      jobTitle: job.title,
      skills: job.requirements || [],
      location: null,
      experience: null,
    }

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      const result = await this.discoveryService.sourceCandidates(request, onProgress)
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }
}
