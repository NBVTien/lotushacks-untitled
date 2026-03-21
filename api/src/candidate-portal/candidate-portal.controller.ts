import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response, Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CandidatePortalService } from './candidate-portal.service'
import type { CreateSavedJDDto } from '@lotushack/shared'

@Controller('candidate-portal')
@UseGuards(JwtAuthGuard)
export class CandidatePortalController {
  constructor(private readonly portalService: CandidatePortalService) {}

  @Post('cv')
  @UseInterceptors(FileInterceptor('cv'))
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request
  ) {
    const user = req.user as { id: string }
    return this.portalService.uploadCv(user.id, file)
  }

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const user = req.user as { id: string }
    return this.portalService.getProfile(user.id)
  }

  @Post('saved-jds')
  async saveJd(@Body() dto: CreateSavedJDDto, @Req() req: Request) {
    const user = req.user as { id: string }
    return this.portalService.saveJd(user.id, dto)
  }

  @Get('saved-jds')
  async listSavedJds(@Req() req: Request) {
    const user = req.user as { id: string }
    return this.portalService.listSavedJds(user.id)
  }

  @Delete('saved-jds/:id')
  async deleteSavedJd(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string }
    return this.portalService.deleteSavedJd(user.id, id)
  }

  @Post('gap-analysis')
  async analyzeGap(@Body() body: { savedJdId: string }, @Req() req: Request) {
    const user = req.user as { id: string }
    return this.portalService.analyzeGap(user.id, body.savedJdId)
  }

  @Post('learning-resources/skill')
  async discoverResourcesForSkill(
    @Body() body: { skill: string; savedJdId?: string },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const user = req.user as { id: string }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // Check for cached results for this specific skill
    if (body.savedJdId) {
      const cached = await this.portalService.getCachedResourcesForSkill(user.id, body.savedJdId, body.skill)
      if (cached) {
        res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Loading cached results...' })}\n\n`)
        res.write(`data: ${JSON.stringify({ type: 'skill-complete', skill: body.skill, result: cached })}\n\n`)
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
        return
      }
    }

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      const result = await this.portalService.discoverResourcesForSkill(
        body.skill,
        onProgress,
        body.savedJdId ? { userId: user.id, savedJdId: body.savedJdId } : undefined
      )
      res.write(`data: ${JSON.stringify({ type: 'skill-complete', skill: body.skill, result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }

  @Post('learning-resources')
  async discoverResources(
    @Body() body: { gaps: string[]; skills: string[]; savedJdId?: string },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const user = req.user as { id: string }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // Check for cached results
    if (body.savedJdId) {
      const cached = await this.portalService.getCachedResources(user.id, body.savedJdId)
      if (cached) {
        res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Loading cached results...' })}\n\n`)
        res.write(`data: ${JSON.stringify({ type: 'complete', result: cached })}\n\n`)
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
        return
      }
    }

    const onProgress = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`)
    }

    try {
      const result = await this.portalService.discoverResources(
        body.gaps,
        body.skills,
        onProgress,
        body.savedJdId ? { userId: user.id, savedJdId: body.savedJdId } : undefined
      )
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }
}
