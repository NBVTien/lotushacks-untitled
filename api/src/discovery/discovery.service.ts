import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import OpenAI from 'openai'
import { TinyFishCrawlService, type ProgressCallback } from '../enrichment/tinyfish-crawl.service'
import { SourcingResultEntity } from '../database/sourcing-result.entity'
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
  private readonly openai: OpenAI

  constructor(
    private readonly tinyfish: TinyFishCrawlService,
    private readonly config: ConfigService,
    @InjectRepository(SourcingResultEntity)
    private readonly sourcingResultRepo: Repository<SourcingResultEntity>
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY', ''),
    })
  }

  // ─── Feature C: Job Discovery ───────────────────────────────────────

  async discoverJobs(
    request: JobDiscoveryRequest,
    onProgress?: ProgressCallback
  ): Promise<JobDiscoveryResult> {
    const skillsQuery = request.skills.slice(0, 5).join(', ')
    const titleQuery = request.title || skillsQuery
    const locationQuery = request.location || 'Vietnam'
    const searchQuery = `${titleQuery} ${skillsQuery}`

    this.logger.log(`Job discovery: skills=${skillsQuery}, location=${locationQuery}`)
    onProgress?.('Starting job discovery across multiple sources...')

    const jobJsonFormat =
      'For each job found, return JSON array with objects containing:\n' +
      '- title (string): job title\n' +
      '- company (string): company name\n' +
      '- location (string|null): job location\n' +
      '- url (string): link to the job posting (full URL)\n' +
      '- salary (string|null): salary or budget if shown\n' +
      '- requirements (string[]): key requirements or skills mentioned\n' +
      '- postedDate (string|null): when the job was posted\n' +
      'Return a JSON array of up to 10 job listings. If no jobs found, return empty array [].'

    // Upwork: search via Google with 1-month filter to get fresh job listings
    const upworkGoal =
      `Look at the Google search results for Upwork job listings. ` +
      `Click on the Upwork job links and extract job details. ` +
      `If a link leads to a job posting page, extract the full details. ` +
      `If it leads to a search results page, extract jobs from there. ${jobJsonFormat}`

    const sources = [
      {
        name: 'Upwork',
        url: `https://www.google.com/search?q=site:upwork.com+jobs+${encodeURIComponent(titleQuery + ' ' + skillsQuery)}&tbs=qdr:m`,
        profile: 'stealth' as const,
        goal: upworkGoal,
      },
    ]

    const crawlTasks = sources.map((source) =>
      this.tinyfish
        .crawl(source.url, source.goal, {
          browserProfile: source.profile,
          label: source.name,
          onProgress,
        })
        .then((raw) => this.parseDiscoveredJobs(raw, source.name, skillsQuery))
        .catch((err) => {
          this.logger.error(`${source.name} crawl failed:`, err)
          onProgress?.(`[${source.name}] Failed: ${err.message}`)
          return [] as DiscoveredJob[]
        })
    )

    const results = await Promise.all(crawlTasks)
    const allJobs = results.flat()
    const activeSources = sources.filter((_, i) => results[i].length > 0).map((s) => s.name)

    onProgress?.(
      `Job discovery complete: found ${allJobs.length} jobs from ${activeSources.length} sources`
    )

    return {
      query: searchQuery,
      jobs: allJobs,
      sources: activeSources,
      searchedAt: new Date().toISOString(),
    }
  }

  private parseDiscoveredJobs(
    raw: string | null,
    source: string,
    skillsQuery: string
  ): DiscoveredJob[] {
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

  // ─── AI Job Ranking against CV ─────────────────────────────────────

  async rankJobsByCv(
    jobs: DiscoveredJob[],
    cvText: string,
    skills: string[],
    onProgress?: ProgressCallback
  ): Promise<DiscoveredJob[]> {
    if (jobs.length === 0) return jobs

    onProgress?.(`Ranking ${jobs.length} jobs against your CV using AI...`)

    const jobSummaries = jobs.map((j, i) => ({
      index: i,
      title: j.title,
      company: j.company,
      requirements: j.requirements.join(', '),
      salary: j.salary,
      location: j.location,
    }))

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              "You are a job-matching AI. Score each job against the candidate's CV.\n" +
              'For each job, return a JSON array of objects with:\n' +
              '- index (number): the job index from the input\n' +
              '- matchScore (number): 0-100 score of how well the job matches the CV\n' +
              '- matchReason (string): 1-2 sentence explanation of why this score\n' +
              'Return ONLY a JSON array, sorted by matchScore descending.',
          },
          {
            role: 'user',
            content:
              `CANDIDATE CV TEXT:\n${cvText.slice(0, 3000)}\n\n` +
              `CANDIDATE SKILLS: ${skills.join(', ')}\n\n` +
              `JOBS TO RANK:\n${JSON.stringify(jobSummaries, null, 2)}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        this.logger.warn('No response from OpenAI for job ranking')
        return jobs
      }

      const parsed = JSON.parse(content)
      const rankings: { index: number; matchScore: number; matchReason: string }[] = Array.isArray(
        parsed
      )
        ? parsed
        : parsed.rankings || parsed.jobs || parsed.results || []

      // Apply scores to jobs
      for (const rank of rankings) {
        if (rank.index >= 0 && rank.index < jobs.length) {
          jobs[rank.index].matchScore = rank.matchScore
          jobs[rank.index].matchReason = rank.matchReason
        }
      }

      // Sort by matchScore descending
      jobs.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))

      onProgress?.(
        `AI ranking complete — top match: "${jobs[0]?.title}" (${jobs[0]?.matchScore}/100)`
      )
      return jobs
    } catch (err) {
      this.logger.error('AI job ranking failed:', err)
      onProgress?.(`AI ranking failed: ${err instanceof Error ? err.message : String(err)}`)
      return jobs
    }
  }

  // ─── Feature D: Company Research ────────────────────────────────────

  async researchCompany(
    companyName: string,
    companyUrl?: string | null,
    onProgress?: ProgressCallback
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
          { browserProfile: 'lite', label: 'Glassdoor', onProgress }
        )
        .then((data) => ({ type: 'glassdoor', data }))
    )

    // 2. Tech blog / engineering
    crawlTasks.push(
      this.tinyfish
        .crawl(
          `https://www.google.com/search?q=${encodeURIComponent(`"${companyName}" tech blog engineering`)}`,
          "Find this company's tech blog or engineering blog. Extract:\n" +
            '- techBlog (string|null): URL of the tech blog\n' +
            '- recentNews (string[]): up to 5 recent headlines or articles about the company\n' +
            "- summary (string): 2-3 sentence overview of the company's tech presence\n" +
            'Return as JSON.',
          { browserProfile: 'lite', label: 'TechBlog', onProgress }
        )
        .then((data) => ({ type: 'techblog', data }))
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
            { browserProfile: 'lite', label: 'CompanyWebsite', onProgress }
          )
          .then((data) => ({ type: 'website', data }))
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
    jobId?: string,
    jobDescription?: string,
    requirements?: string[]
  ): Promise<SourcingResult> {
    const skillsQuery = request.skills.slice(0, 5).join(', ')
    const titleQuery = request.jobTitle
    const searchQuery = `${titleQuery} ${skillsQuery}`

    this.logger.log(`Candidate sourcing: title=${titleQuery}, skills=${skillsQuery}`)
    onProgress?.('Starting candidate sourcing across multiple platforms...')

    const candidateExtractPrompt =
      'Extract all visible candidate/developer/freelancer profiles from this page. For each person, return JSON array with objects:\n' +
      '- name (string): full name\n' +
      '- title (string|null): job title, headline, or specialization\n' +
      '- profileUrl (string): link to their full profile (full URL)\n' +
      '- skills (string[]): listed skills or technologies\n' +
      '- experience (string|null): years of experience, success rate, or current role\n' +
      '- summary (string): brief summary — what they do, rating, hourly rate if visible\n' +
      'Return a JSON array of up to 10 profiles. If no profiles found, return empty array [].'

    // Only Toptal source
    const sources = [
      {
        name: 'Toptal',
        url: `https://www.toptal.com/developers?skill=${encodeURIComponent(request.skills[0] || 'javascript')}`,
        profile: 'lite' as const,
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
          onProgress?.(
            `[${source.name}] Failed: ${err instanceof Error ? err.message : String(err)}`
          )
          return [] as SourcedCandidate[]
        })
    )

    const results = await Promise.all(crawlTasks)
    let allCandidates = results.flat()
    const activeSources = sources.filter((_, i) => results[i].length > 0).map((s) => s.name)

    onProgress?.(
      `Sourcing complete: found ${allCandidates.length} candidates from ${activeSources.length} sources`
    )

    // Step 2: Fetch profile details for each candidate
    if (allCandidates.length > 0) {
      allCandidates = await this.fetchCandidateDetails(allCandidates, onProgress)
    }

    // Step 3: AI evaluate against job requirements
    if (allCandidates.length > 0 && requirements && requirements.length > 0) {
      allCandidates = await this.evaluateCandidatesAgainstJob(
        allCandidates,
        titleQuery,
        requirements,
        jobDescription,
        onProgress
      )
    }

    const sourcingResult: SourcingResult = {
      query: searchQuery,
      candidates: allCandidates,
      sources: activeSources,
      searchedAt: new Date().toISOString(),
    }

    // Step 4: Save to DB with dedup
    if (jobId) {
      await this.saveSourcingResult(jobId, searchQuery, allCandidates, activeSources)
    }

    return sourcingResult
  }

  // ─── Profile Detail Fetching ──────────────────────────────────────

  private async fetchCandidateDetails(
    candidates: SourcedCandidate[],
    onProgress?: ProgressCallback
  ): Promise<SourcedCandidate[]> {
    onProgress?.(`Fetching detailed profiles for ${candidates.length} candidates...`)

    const detailedCandidates = await Promise.all(
      candidates.map(async (candidate, index) => {
        if (!candidate.profileUrl) return candidate

        try {
          onProgress?.(`[${index + 1}/${candidates.length}] Fetching profile: ${candidate.name}`)

          // Try direct fetch first
          let html: string | null = null
          let useDirectFetch = false

          try {
            const response = await fetch(candidate.profileUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
              },
              signal: AbortSignal.timeout(10000),
            })

            if (response.ok) {
              html = await response.text()
              // Check if the page is Cloudflare blocked or too short
              if (
                html.length > 1000 &&
                !html.includes('Attention Required') &&
                !html.includes('Cloudflare')
              ) {
                useDirectFetch = true
              } else {
                html = null
              }
            }
          } catch {
            // Direct fetch failed, will fall back to TinyFish
            this.logger.debug(
              `Direct fetch failed for ${candidate.profileUrl}, using TinyFish fallback`
            )
          }

          if (useDirectFetch && html) {
            // Use OpenAI to extract structured data from HTML
            const extracted = await this.extractProfileFromHtml(html, candidate.name)
            if (extracted) {
              candidate.summary = extracted.summary || candidate.summary
              candidate.skills = extracted.skills.length > 0 ? extracted.skills : candidate.skills
              candidate.experience = extracted.experience || candidate.experience
              candidate.detailedProfile = extracted.detailedProfile
            }
          } else {
            // Fall back to TinyFish stealth crawl
            onProgress?.(
              `[${index + 1}/${candidates.length}] Using TinyFish for ${candidate.name}...`
            )
            const crawlResult = await this.tinyfish.crawl(
              candidate.profileUrl,
              'Extract the full profile details of this developer/freelancer. Return JSON with:\n' +
                '- name (string): full name\n' +
                '- title (string|null): job title or headline\n' +
                '- bio (string): full bio or about section\n' +
                '- skills (array of {name: string, years: number|null}): skills with years of experience\n' +
                '- experience (string): years of experience summary\n' +
                '- portfolio (string[]): portfolio project names or URLs\n' +
                '- availability (string|null): availability status\n' +
                '- hourlyRate (string|null): hourly rate if visible\n' +
                '- expertise (string|null): areas of expertise\n' +
                'Return as JSON.',
              { browserProfile: 'stealth', label: `Profile:${candidate.name}`, onProgress }
            )

            if (crawlResult) {
              try {
                const parsed = JSON.parse(crawlResult)
                candidate.summary =
                  [parsed.bio, parsed.expertise, parsed.hourlyRate && `Rate: ${parsed.hourlyRate}`]
                    .filter(Boolean)
                    .join(' | ') || candidate.summary
                candidate.skills = Array.isArray(parsed.skills)
                  ? parsed.skills.map((s: { name: string } | string) =>
                      typeof s === 'string' ? s : s.name
                    )
                  : candidate.skills
                candidate.experience = parsed.experience || candidate.experience
                candidate.detailedProfile = crawlResult
              } catch {
                this.logger.warn(`Failed to parse TinyFish profile result for ${candidate.name}`)
                candidate.detailedProfile = crawlResult
              }
            }
          }
        } catch (err) {
          this.logger.error(`Failed to fetch details for ${candidate.name}:`, err)
        }

        return candidate
      })
    )

    onProgress?.(`Profile details fetched for ${detailedCandidates.length} candidates`)
    return detailedCandidates
  }

  private async extractProfileFromHtml(
    html: string,
    candidateName: string
  ): Promise<{
    summary: string
    skills: string[]
    experience: string | null
    detailedProfile: string
  } | null> {
    try {
      // Truncate HTML to fit in context
      const truncatedHtml = html.slice(0, 15000)

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are extracting structured profile data from HTML. Return JSON with:\n' +
              '- name (string): full name\n' +
              '- title (string|null): job title or headline\n' +
              '- bio (string): bio or about text\n' +
              '- skills (string[]): list of skills/technologies\n' +
              '- experience (string|null): years of experience or experience summary\n' +
              '- portfolio (string[]): portfolio projects if any\n' +
              '- expertiseYears (number|null): total years of expertise\n' +
              '- summary (string): 2-3 sentence professional summary\n' +
              'Return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: `Extract profile data for "${candidateName}" from this HTML:\n\n${truncatedHtml}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return null

      const parsed = JSON.parse(content)
      return {
        summary: parsed.summary || parsed.bio || '',
        skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
        experience:
          parsed.experience || (parsed.expertiseYears ? `${parsed.expertiseYears} years` : null),
        detailedProfile: content,
      }
    } catch (err) {
      this.logger.error(`OpenAI profile extraction failed for ${candidateName}:`, err)
      return null
    }
  }

  // ─── AI Evaluation Against Job ────────────────────────────────────

  async evaluateCandidatesAgainstJob(
    candidates: SourcedCandidate[],
    jobTitle: string,
    requirements: string[],
    jobDescription?: string,
    onProgress?: ProgressCallback
  ): Promise<SourcedCandidate[]> {
    if (candidates.length === 0) return candidates

    onProgress?.(`Evaluating ${candidates.length} candidates against job requirements using AI...`)

    const candidateSummaries = candidates.map((c, i) => ({
      index: i,
      name: c.name,
      title: c.title,
      skills: c.skills.join(', '),
      experience: c.experience,
      summary: c.summary,
      detailedProfile: c.detailedProfile?.slice(0, 500) || null,
    }))

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a recruitment AI. Score each candidate (0-100) against the job requirements.\n' +
              'For each candidate, return a JSON object with a "rankings" array containing:\n' +
              '- index (number): candidate index from input\n' +
              '- matchScore (number): 0-100 fit score\n' +
              '- matchReason (string): 2-3 sentence explanation of fit/gaps\n' +
              'Sort by matchScore descending. Return ONLY valid JSON with a "rankings" key.',
          },
          {
            role: 'user',
            content:
              `JOB TITLE: ${jobTitle}\n` +
              `REQUIREMENTS: ${requirements.join(', ')}\n` +
              (jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 2000)}\n\n` : '\n') +
              `CANDIDATES:\n${JSON.stringify(candidateSummaries, null, 2)}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        this.logger.warn('No response from OpenAI for candidate evaluation')
        return candidates
      }

      const parsed = JSON.parse(content)
      const rankings: { index: number; matchScore: number; matchReason: string }[] = Array.isArray(
        parsed
      )
        ? parsed
        : parsed.rankings || parsed.candidates || parsed.results || []

      // Apply scores to candidates
      for (const rank of rankings) {
        if (rank.index >= 0 && rank.index < candidates.length) {
          candidates[rank.index].matchScore = rank.matchScore
          candidates[rank.index].matchReason = rank.matchReason
        }
      }

      // Sort by matchScore descending
      candidates.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))

      onProgress?.(
        `AI evaluation complete — top candidate: "${candidates[0]?.name}" (${candidates[0]?.matchScore}/100)`
      )
      return candidates
    } catch (err) {
      this.logger.error('AI candidate evaluation failed:', err)
      onProgress?.(`AI evaluation failed: ${err instanceof Error ? err.message : String(err)}`)
      return candidates
    }
  }

  // ─── Save to DB with Dedup ────────────────────────────────────────

  private async saveSourcingResult(
    jobId: string,
    query: string,
    candidates: SourcedCandidate[],
    sources: string[]
  ): Promise<void> {
    try {
      // Check for existing result for this jobId
      const existing = await this.sourcingResultRepo.findOne({ where: { jobId } })

      if (existing) {
        // Dedup by profileUrl: merge new candidates with existing ones
        const existingUrls = new Map(existing.candidates.map((c) => [c.profileUrl, c]))

        for (const candidate of candidates) {
          existingUrls.set(candidate.profileUrl, candidate)
        }

        existing.candidates = Array.from(existingUrls.values())
        existing.sources = [...new Set([...existing.sources, ...sources])]
        existing.query = query

        await this.sourcingResultRepo.save(existing)
        this.logger.log(
          `Updated existing sourcing result for job ${jobId} with ${existing.candidates.length} candidates`
        )
      } else {
        const result = this.sourcingResultRepo.create({
          jobId,
          query,
          candidates,
          sources,
        })

        await this.sourcingResultRepo.save(result)
        this.logger.log(
          `Saved new sourcing result for job ${jobId} with ${candidates.length} candidates`
        )
      }
    } catch (err) {
      this.logger.error('Failed to save sourcing result:', err)
    }
  }

  async getSourcingHistory(jobId: string): Promise<SourcingResultEntity[]> {
    return this.sourcingResultRepo.find({
      where: { jobId },
      order: { searchedAt: 'DESC' },
    })
  }

  // ─── Parse Sourced Candidates ─────────────────────────────────────

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
