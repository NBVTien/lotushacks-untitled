import { Injectable, Logger } from '@nestjs/common'
import { TinyFishCrawlService, type ProgressCallback } from '../enrichment/tinyfish-crawl.service'
import type {
  JobDiscoveryRequest,
  JobDiscoveryResult,
  DiscoveredJob,
  CompanyResearch,
  SourcingRequest,
  SourcingResult,
  SourcedCandidate,
} from '@lotushack/shared'

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name)

  constructor(private readonly tinyfish: TinyFishCrawlService) {}

  // ─── Feature C: Job Discovery ───────────────────────────────────────

  async discoverJobs(
    request: JobDiscoveryRequest,
    onProgress?: ProgressCallback,
  ): Promise<JobDiscoveryResult> {
    const skillsQuery = request.skills.slice(0, 5).join(', ')
    const titleQuery = request.title || skillsQuery
    const locationQuery = request.location || 'Vietnam'
    const searchQuery = `${titleQuery} ${skillsQuery}`

    this.logger.log(`Job discovery: skills=${skillsQuery}, location=${locationQuery}`)
    onProgress?.('Starting job discovery across multiple sources...')

    const jobListingPrompt =
      'Extract all visible job listings from this page. For each job, return JSON array with objects containing:\n' +
      '- title (string): job title\n' +
      '- company (string): company name\n' +
      '- location (string|null): job location\n' +
      '- url (string): link to the job posting (full URL)\n' +
      '- salary (string|null): salary if shown\n' +
      '- requirements (string[]): key requirements or skills mentioned\n' +
      '- postedDate (string|null): when the job was posted\n' +
      'Return a JSON array of up to 10 job listings. If no jobs found, return empty array [].'

    const sources = [
      {
        name: 'ITviec',
        url: `https://itviec.com/it-jobs?query=${encodeURIComponent(skillsQuery)}&location=${encodeURIComponent(locationQuery)}`,
        profile: 'lite' as const,
      },
      {
        name: 'TopDev',
        url: `https://topdev.vn/viec-lam-it?search=${encodeURIComponent(skillsQuery)}`,
        profile: 'lite' as const,
      },
      {
        name: 'LinkedIn',
        url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(skillsQuery)}&location=${encodeURIComponent(locationQuery)}`,
        profile: 'stealth' as const,
      },
    ]

    const crawlTasks = sources.map((source) =>
      this.tinyfish
        .crawl(source.url, jobListingPrompt, {
          browserProfile: source.profile,
          label: source.name,
          onProgress,
        })
        .then((raw) => this.parseDiscoveredJobs(raw, source.name, skillsQuery))
        .catch((err) => {
          this.logger.error(`${source.name} crawl failed:`, err)
          onProgress?.(`[${source.name}] Failed: ${err.message}`)
          return [] as DiscoveredJob[]
        }),
    )

    const results = await Promise.all(crawlTasks)
    const allJobs = results.flat()
    const activeSources = sources
      .filter((_, i) => results[i].length > 0)
      .map((s) => s.name)

    onProgress?.(`Job discovery complete: found ${allJobs.length} jobs from ${activeSources.length} sources`)

    return {
      query: searchQuery,
      jobs: allJobs,
      sources: activeSources,
      searchedAt: new Date().toISOString(),
    }
  }

  private parseDiscoveredJobs(raw: string | null, source: string, skillsQuery: string): DiscoveredJob[] {
    if (!raw) return []

    try {
      let data = JSON.parse(raw)
      if (!Array.isArray(data)) {
        // Try to find an array in the parsed object
        if (data.jobs && Array.isArray(data.jobs)) data = data.jobs
        else if (data.results && Array.isArray(data.results)) data = data.results
        else return []
      }

      return data.slice(0, 10).map((item: Record<string, unknown>) => ({
        title: String(item.title || 'Untitled'),
        company: String(item.company || 'Unknown'),
        location: item.location ? String(item.location) : null,
        url: String(item.url || ''),
        source,
        salary: item.salary ? String(item.salary) : null,
        requirements: Array.isArray(item.requirements) ? item.requirements.map(String) : [],
        matchReason: `Matches skills: ${skillsQuery}`,
        postedDate: item.postedDate ? String(item.postedDate) : null,
      }))
    } catch {
      this.logger.warn(`Failed to parse ${source} job results`)
      return []
    }
  }

  // ─── Feature D: Company Research ────────────────────────────────────

  async researchCompany(
    companyName: string,
    companyUrl?: string | null,
    onProgress?: ProgressCallback,
  ): Promise<CompanyResearch> {
    this.logger.log(`Company research: ${companyName}`)
    onProgress?.(`Starting research on ${companyName}...`)

    const crawlTasks: Promise<{ type: string; data: string | null }>[] = []

    // 1. Glassdoor reviews
    crawlTasks.push(
      this.tinyfish
        .crawl(
          `https://www.google.com/search?q=${encodeURIComponent(`"${companyName}" glassdoor reviews`)}`,
          'Find Glassdoor reviews for this company. Extract:\n' +
            '- glassdoorUrl (string|null): link to Glassdoor page\n' +
            '- rating (number|null): overall rating (1-5)\n' +
            '- reviews (array of {pros, cons}): up to 5 recent reviews\n' +
            '- culture (string|null): summary of company culture from reviews\n' +
            '- benefits (string[]): commonly mentioned benefits\n' +
            'Return as JSON.',
          { browserProfile: 'lite', label: 'Glassdoor', onProgress },
        )
        .then((data) => ({ type: 'glassdoor', data })),
    )

    // 2. Tech blog / engineering
    crawlTasks.push(
      this.tinyfish
        .crawl(
          `https://www.google.com/search?q=${encodeURIComponent(`"${companyName}" tech blog engineering`)}`,
          'Find this company\'s tech blog or engineering blog. Extract:\n' +
            '- techBlog (string|null): URL of the tech blog\n' +
            '- recentNews (string[]): up to 5 recent headlines or articles about the company\n' +
            '- summary (string): 2-3 sentence overview of the company\'s tech presence\n' +
            'Return as JSON.',
          { browserProfile: 'lite', label: 'TechBlog', onProgress },
        )
        .then((data) => ({ type: 'techblog', data })),
    )

    // 3. Company website (if URL known)
    if (companyUrl) {
      crawlTasks.push(
        this.tinyfish
          .crawl(
            companyUrl,
            'Visit this company website and extract:\n' +
              '- website (string): the website URL\n' +
              '- summary (string): what does this company do? 2-3 sentences\n' +
              '- benefits (string[]): any listed employee benefits or perks\n' +
              '- culture (string|null): any info about company culture\n' +
              'Return as JSON.',
            { browserProfile: 'lite', label: 'CompanyWebsite', onProgress },
          )
          .then((data) => ({ type: 'website', data })),
      )
    }

    const results = await Promise.all(crawlTasks)

    // Merge results
    const research: CompanyResearch = {
      name: companyName,
      website: companyUrl || null,
      glassdoorUrl: null,
      rating: null,
      reviews: [],
      techBlog: null,
      recentNews: [],
      culture: null,
      benefits: [],
      summary: '',
    }

    for (const { type, data } of results) {
      if (!data) continue
      try {
        const parsed = JSON.parse(data)
        if (type === 'glassdoor') {
          research.glassdoorUrl = parsed.glassdoorUrl || null
          research.rating = parsed.rating || null
          research.reviews = (parsed.reviews || []).map((r: Record<string, string>) => ({
            pros: String(r.pros || ''),
            cons: String(r.cons || ''),
          }))
          research.culture = research.culture || parsed.culture || null
          research.benefits = [...research.benefits, ...(parsed.benefits || [])]
        } else if (type === 'techblog') {
          research.techBlog = parsed.techBlog || null
          research.recentNews = parsed.recentNews || []
          research.summary = parsed.summary || ''
        } else if (type === 'website') {
          research.website = research.website || parsed.website || null
          research.summary = research.summary || parsed.summary || ''
          research.culture = research.culture || parsed.culture || null
          research.benefits = [...research.benefits, ...(parsed.benefits || [])]
        }
      } catch {
        this.logger.warn(`Failed to parse ${type} research result`)
      }
    }

    // Deduplicate benefits
    research.benefits = [...new Set(research.benefits)]

    onProgress?.(`Company research complete for ${companyName}`)
    return research
  }

  // ─── Feature A: Candidate Sourcing ──────────────────────────────────

  async sourceCandidates(
    request: SourcingRequest,
    onProgress?: ProgressCallback,
  ): Promise<SourcingResult> {
    const skillsQuery = request.skills.slice(0, 5).join(', ')
    const titleQuery = request.jobTitle
    const locationQuery = request.location || 'Vietnam'
    const searchQuery = `${titleQuery} ${skillsQuery}`

    this.logger.log(`Candidate sourcing: title=${titleQuery}, skills=${skillsQuery}`)
    onProgress?.('Starting candidate sourcing across multiple platforms...')

    const candidateExtractPrompt =
      'Extract all visible candidate/developer profiles from this page. For each candidate, return JSON array with objects:\n' +
      '- name (string): candidate name\n' +
      '- title (string|null): current job title or headline\n' +
      '- profileUrl (string): link to their profile (full URL)\n' +
      '- skills (string[]): listed skills or technologies\n' +
      '- experience (string|null): years of experience or current role description\n' +
      '- summary (string): brief summary of the candidate\n' +
      'Return a JSON array of up to 10 profiles. If no profiles found, return empty array [].'

    const sources = [
      {
        name: 'ITviec',
        url: `https://itviec.com/it-jobs?query=${encodeURIComponent(skillsQuery)}&location=${encodeURIComponent(locationQuery)}`,
        profile: 'lite' as const,
      },
      {
        name: 'TopDev',
        url: `https://topdev.vn/viec-lam-it?search=${encodeURIComponent(skillsQuery)}`,
        profile: 'lite' as const,
      },
      {
        name: 'LinkedIn',
        url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${titleQuery} ${skillsQuery}`)}&origin=GLOBAL_SEARCH_HEADER`,
        profile: 'stealth' as const,
      },
    ]

    const crawlTasks = sources.map((source) =>
      this.tinyfish
        .crawl(source.url, candidateExtractPrompt, {
          browserProfile: source.profile,
          label: source.name,
          onProgress,
        })
        .then((raw) => this.parseSourcedCandidates(raw, source.name))
        .catch((err) => {
          this.logger.error(`${source.name} sourcing crawl failed:`, err)
          onProgress?.(`[${source.name}] Failed: ${err.message}`)
          return [] as SourcedCandidate[]
        }),
    )

    const results = await Promise.all(crawlTasks)
    const allCandidates = results.flat()
    const activeSources = sources
      .filter((_, i) => results[i].length > 0)
      .map((s) => s.name)

    onProgress?.(`Sourcing complete: found ${allCandidates.length} candidates from ${activeSources.length} sources`)

    return {
      query: searchQuery,
      candidates: allCandidates,
      sources: activeSources,
      searchedAt: new Date().toISOString(),
    }
  }

  private parseSourcedCandidates(raw: string | null, source: string): SourcedCandidate[] {
    if (!raw) return []

    try {
      let data = JSON.parse(raw)
      if (!Array.isArray(data)) {
        if (data.candidates && Array.isArray(data.candidates)) data = data.candidates
        else if (data.profiles && Array.isArray(data.profiles)) data = data.profiles
        else if (data.results && Array.isArray(data.results)) data = data.results
        else return []
      }

      return data.slice(0, 10).map((item: Record<string, unknown>) => ({
        name: String(item.name || 'Unknown'),
        title: item.title ? String(item.title) : null,
        profileUrl: String(item.profileUrl || item.url || ''),
        source,
        skills: Array.isArray(item.skills) ? item.skills.map(String) : [],
        experience: item.experience ? String(item.experience) : null,
        summary: String(item.summary || ''),
      }))
    } catch {
      this.logger.warn(`Failed to parse ${source} sourcing results`)
      return []
    }
  }
}
