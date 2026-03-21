import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
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
    @Body('email') email?: string,
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
    @Body('types') types: string[],
  ) {
    return this.candidatesService.extendedEnrich(jobId, id, types)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.candidatesService.delete(id)
  }
}
