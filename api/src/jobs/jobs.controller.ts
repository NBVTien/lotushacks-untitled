import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { JobsService } from './jobs.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import type { CreateJobDto } from '@lotushack/shared'
import type { Request } from 'express'

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateJobDto, @Req() req: Request) {
    const user = req.user as { companyId: string }
    return this.jobsService.create(dto, user.companyId)
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const user = req.user as { companyId: string }
    return this.jobsService.findByCompany(user.companyId, {
      search,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    })
  }

  @Get('public')
  findAllPublic(@Query('page') page = '1', @Query('limit') limit = '10') {
    return this.jobsService.findAllPublic(
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
    )
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats(@Req() req: Request) {
    const user = req.user as { companyId: string }
    return this.jobsService.getStats(user.companyId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateJobDto>) {
    return this.jobsService.update(id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  toggleActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.jobsService.toggleActive(id, isActive)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.jobsService.delete(id)
  }
}
