import { Module } from '@nestjs/common'
import { EnrichmentService } from './enrichment.service'
import { GitHubApiService } from './github-api.service'
import { TinyFishCrawlService } from './tinyfish-crawl.service'
import { ExtendedEnrichmentService } from './extended-enrichment.service'

@Module({
  providers: [EnrichmentService, GitHubApiService, TinyFishCrawlService, ExtendedEnrichmentService],
  exports: [EnrichmentService, GitHubApiService, ExtendedEnrichmentService, TinyFishCrawlService],
})
export class EnrichmentModule {}
