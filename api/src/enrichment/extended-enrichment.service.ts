import { Injectable, Logger } from '@nestjs/common'
import { TinyFishCrawlService, type ProgressCallback } from './tinyfish-crawl.service'
import type {
  ExtendedEnrichment,
  ExtendedEnrichmentType,
  LinkedInProfile,
  PortfolioAnalysis,
  LiveProjectCheck,
  BlogAnalysis,
  StackOverflowProfile,
  CompanyIntel,
  ParsedCVData,
} from '@lotushack/shared'

@Injectable()
export class ExtendedEnrichmentService {
  private readonly logger = new Logger(ExtendedEnrichmentService.name)

  constructor(private readonly tinyfish: TinyFishCrawlService) {}

  async enrich(
    types: ExtendedEnrichmentType[],
    context: {
      linkedinUrl?: string | null
      portfolioUrls: string[]
      projectUrls: string[]
      blogUrls: string[]
      stackoverflowUrl: string | null
      parsedCV: ParsedCVData | null
      companyUrl?: string
      companyName?: string
    },
    existing: ExtendedEnrichment | null,
    onProgress?: ProgressCallback
  ): Promise<ExtendedEnrichment & { _linkedin?: LinkedInProfile | null }> {
    const result: ExtendedEnrichment & { _linkedin?: LinkedInProfile | null } = existing || {
      portfolio: null,
      liveProjects: [],
      blog: null,
      stackoverflow: null,
    }

    const tasks: Promise<void>[] = []

    if (types.includes('linkedin') && context.linkedinUrl) {
      tasks.push(
        this.enrichLinkedIn(context.linkedinUrl, onProgress).then((r) => {
          result._linkedin = r
        })
      )
    }

    if (types.includes('portfolio') && context.portfolioUrls.length > 0) {
      tasks.push(
        this.enrichPortfolio(context.portfolioUrls[0], onProgress).then((r) => {
          result.portfolio = r
        })
      )
    }

    if (types.includes('liveProjects') && context.projectUrls.length > 0) {
      tasks.push(
        this.enrichLiveProjects(context.projectUrls.slice(0, 3), onProgress).then((r) => {
          result.liveProjects = r
        })
      )
    }

    if (types.includes('blog') && context.blogUrls.length > 0) {
      tasks.push(
        this.enrichBlog(context.blogUrls[0], onProgress).then((r) => {
          result.blog = r
        })
      )
    }

    if (types.includes('stackoverflow') && context.stackoverflowUrl) {
      tasks.push(
        this.enrichStackOverflow(context.stackoverflowUrl, onProgress).then((r) => {
          result.stackoverflow = r
        })
      )
    }

    if (types.includes('companyIntel')) {
      if (context.companyUrl && context.companyName) {
        // Per-company enrichment: use the provided URL directly
        tasks.push(
          this.enrichSingleCompany(context.companyName, context.companyUrl, onProgress).then((r) => {
            // Merge with existing companyIntel array
            const existing = result.companyIntel || []
            const idx = existing.findIndex((c) => c.company === context.companyName)
            if (idx >= 0) {
              existing[idx] = r
            } else {
              existing.push(r)
            }
            result.companyIntel = existing
          })
        )
      } else if (context.parsedCV?.experience?.length) {
        // Default: enrich all companies from experience
        tasks.push(
          this.enrichCompanyIntel(context.parsedCV.experience, onProgress).then((r) => {
            result.companyIntel = r
          })
        )
      }
    }

    await Promise.all(tasks)
    return result
  }

  private async enrichLinkedIn(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<LinkedInProfile | null> {
    const publicUrl = url.includes('?') ? url : `${url}?trk=people_guest_people_search-card`
    this.logger.log(`Enriching LinkedIn: ${publicUrl}`)

    const linkedinPrompt =
      'GOAL: Extract LinkedIn profile data. Try these methods IN ORDER until you get data:\n\n' +
      'METHOD 1 — Direct public view:\n' +
      '- Visit the provided URL (it has ?trk= param for guest view)\n' +
      '- Scroll down, click "see more" buttons to expand sections\n' +
      '- Extract all visible data: name, headline, About, Experience, Education, Skills, Activity\n' +
      '- If you can see profile data, extract it and return JSON. DONE.\n\n' +
      'METHOD 2 — If METHOD 1 shows login wall or "Join LinkedIn":\n' +
      '- Go to Google: https://www.google.com/search?q=site:linkedin.com/in/ "PERSON_NAME"\n' +
      '- Look at the Google search snippets\n' +
      '- Click on cached version if available\n' +
      '- Extract whatever data is visible. DONE.\n\n' +
      'METHOD 3 — If METHOD 2 also fails:\n' +
      '- Go to https://translate.yandex.com/translate\n' +
      '- Paste the original LinkedIn URL into the translation input\n' +
      '- Select English → any language\n' +
      '- Extract data from the translated page. DONE.\n\n' +
      'IMPORTANT: Do NOT visit SignalHire, RocketReach, or people-search sites.\n\n' +
      'Return JSON with keys: headline, location, summary, ' +
      'experience (array of {title, company, duration, description}), ' +
      'skills (array of strings), education (array of {degree, school, years}), ' +
      'activity (array of strings), certifications (array of strings), ' +
      'method_used (string: "direct", "google", or "yandex")'

    const raw = await this.tinyfish.crawl(publicUrl, linkedinPrompt, {
      browserProfile: 'stealth',
      label: 'LinkedIn',
      onProgress,
    })

    if (!raw) {
      onProgress?.('[LinkedIn] No data returned')
      return null
    }

    const result = this.parseLinkedInResponse(raw)
    onProgress?.(
      `[LinkedIn] Done: ${result.experience.length} experiences, ${result.skills.length} skills`
    )
    return result
  }

  private parseLinkedInResponse(raw: string): LinkedInProfile {
    try {
      const data = JSON.parse(raw)

      if (data.repositories || data.top_languages || data.total_stars !== undefined) {
        this.logger.warn('LinkedIn response contains GitHub data')
        return { headline: null, summary: null, experience: [], skills: [], raw }
      }

      let experience: string[] = []
      if (Array.isArray(data.experience)) {
        experience = data.experience.map((e: unknown) => {
          if (typeof e === 'string') return e
          const exp = e as Record<string, string>
          return [exp.title, exp.company, exp.duration, exp.description].filter(Boolean).join(' — ')
        })
      }

      let skills: string[] = data.skills || []
      if (!Array.isArray(skills)) skills = []

      return {
        headline: data.headline || null,
        summary: data.summary || data.about || null,
        experience,
        skills,
        raw,
      }
    } catch {
      return { headline: null, summary: null, experience: [], skills: [], raw }
    }
  }

  private async enrichPortfolio(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<PortfolioAnalysis | null> {
    this.logger.log(`Portfolio analysis: ${url}`)
    const raw = await this.tinyfish.crawl(
      url,
      'Visit this personal portfolio/website. Analyze it and return JSON:\n' +
        '- isOnline (boolean): does the page load successfully?\n' +
        '- techStack (string[]): detected technologies (React, WordPress, Next.js, etc.)\n' +
        '- designQuality (string): "professional", "good", "basic", or "template"\n' +
        '- hasResponsive (boolean): does it look good on mobile? (check viewport)\n' +
        '- summary (string): 2-3 sentence description of the website, what it showcases\n' +
        '- sections (string[]): list main sections/pages visible',
      { label: 'Portfolio', onProgress }
    )

    if (!raw) return null

    try {
      const data = JSON.parse(raw)
      return {
        url,
        isOnline: data.isOnline ?? true,
        techStack: data.techStack || [],
        designQuality: data.designQuality || 'unknown',
        hasResponsive: data.hasResponsive ?? false,
        summary: data.summary || '',
      }
    } catch {
      return {
        url,
        isOnline: true,
        techStack: [],
        designQuality: 'unknown',
        hasResponsive: false,
        summary: raw.slice(0, 500),
      }
    }
  }

  private async enrichLiveProjects(
    urls: string[],
    onProgress?: ProgressCallback
  ): Promise<LiveProjectCheck[]> {
    const results: LiveProjectCheck[] = []

    for (const url of urls) {
      this.logger.log(`Live project check: ${url}`)
      const raw = await this.tinyfish.crawl(
        url,
        'Visit this web application/project. Check if it works and analyze it. Return JSON:\n' +
          '- isOnline (boolean): does the app load?\n' +
          '- techDetected (string[]): technologies visible (React, Vue, Angular, etc.)\n' +
          '- uiQuality (string): "polished", "functional", "basic", or "broken"\n' +
          '- features (string[]): list main features/pages you can see\n' +
          '- summary (string): 2-3 sentence description of what this app does and its quality',
        { label: `Project: ${url}`, onProgress }
      )

      if (!raw) {
        results.push({
          url,
          name: url,
          isOnline: false,
          techDetected: [],
          uiQuality: 'unknown',
          features: [],
          summary: 'Could not access',
        })
        continue
      }

      try {
        const data = JSON.parse(raw)
        results.push({
          url,
          name: data.name || url.replace(/https?:\/\//, '').split('/')[0],
          isOnline: data.isOnline ?? true,
          techDetected: data.techDetected || [],
          uiQuality: data.uiQuality || 'unknown',
          features: data.features || [],
          summary: data.summary || '',
        })
      } catch {
        results.push({
          url,
          name: url,
          isOnline: true,
          techDetected: [],
          uiQuality: 'unknown',
          features: [],
          summary: raw.slice(0, 300),
        })
      }
    }

    return results
  }

  private async enrichBlog(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<BlogAnalysis | null> {
    this.logger.log(`Blog analysis: ${url}`)
    const raw = await this.tinyfish.crawl(
      url,
      'Visit this developer blog/profile page. Extract:\n' +
        '- platform (string): "dev.to", "medium", "hashnode", "personal", etc.\n' +
        '- totalPosts (number): how many posts visible or stated\n' +
        '- recentPosts (array of {title, date, tags}): last 5 posts\n' +
        '- topicFocus (string[]): main topics the author writes about\n' +
        '- writingQuality (string): "excellent", "good", "basic"\n' +
        '- summary (string): 2-3 sentence assessment of their technical writing\n' +
        'Return as JSON.',
      { label: 'Blog', onProgress }
    )

    if (!raw) return null

    try {
      const data = JSON.parse(raw)
      return {
        platform: data.platform || 'unknown',
        url,
        totalPosts: data.totalPosts || 0,
        recentPosts: (data.recentPosts || []).map((p: Record<string, unknown>) => ({
          title: String(p.title || ''),
          date: String(p.date || ''),
          tags: (p.tags as string[]) || [],
        })),
        topicFocus: data.topicFocus || [],
        writingQuality: data.writingQuality || 'unknown',
        summary: data.summary || '',
      }
    } catch {
      return {
        platform: 'unknown',
        url,
        totalPosts: 0,
        recentPosts: [],
        topicFocus: [],
        writingQuality: 'unknown',
        summary: raw.slice(0, 300),
      }
    }
  }

  private async enrichSingleCompany(
    company: string,
    companyUrl: string,
    onProgress?: ProgressCallback
  ): Promise<CompanyIntel> {
    this.logger.log(`Company intel (direct URL): ${company} → ${companyUrl}`)
    onProgress?.(`[CompanyIntel] Researching ${company} via ${companyUrl}`)

    const raw = await this.tinyfish.crawl(
      companyUrl,
      `Research the company "${company}" thoroughly using this website as starting point.\n\n` +
        'STEP 1: Visit the provided URL and gather basic company info.\n' +
        'STEP 2: Search Google for additional details — try queries like:\n' +
        `  - "${company}" company overview\n` +
        `  - "${company}" glassdoor reviews\n` +
        `  - "${company}" linkedin company\n` +
        `  - "${company}" crunchbase\n` +
        'STEP 3: Visit 2-3 of the most relevant results to gather comprehensive data.\n\n' +
        'Extract and return as JSON:\n' +
        '- url (string|null): the company official website URL\n' +
        '- exists (boolean): is this a real, active company?\n' +
        '- industry (string|null): industry sector\n' +
        '- techStack (string[]): technologies used (languages, frameworks, cloud providers)\n' +
        '- size (string|null): company size (e.g. "50-200", "startup", "enterprise")\n' +
        '- founded (string|null): year founded if available\n' +
        '- headquarters (string|null): location if available\n' +
        '- summary (string): 3-4 sentence comprehensive description\n',
      { browserProfile: 'lite', label: `CompanyIntel: ${company}`, onProgress, timeoutMs: 300_000 }
    )

    if (!raw) {
      onProgress?.(`[CompanyIntel] Done: could not access ${company}`)
      return {
        company,
        url: companyUrl,
        exists: false,
        industry: null,
        techStack: [],
        size: null,
        founded: null,
        headquarters: null,
        summary: 'Could not verify',
      }
    }

    try {
      const data = JSON.parse(raw)
      onProgress?.(`[CompanyIntel] Done: ${company} researched`)
      return {
        company,
        url: data.url || companyUrl,
        exists: data.exists ?? true,
        industry: data.industry || null,
        techStack: data.techStack || [],
        size: data.size || null,
        founded: data.founded || null,
        headquarters: data.headquarters || null,
        summary: data.summary || '',
      }
    } catch {
      onProgress?.(`[CompanyIntel] Done: ${company} researched (parse warning)`)
      return {
        company,
        url: companyUrl,
        exists: true,
        industry: null,
        techStack: [],
        size: null,
        founded: null,
        headquarters: null,
        summary: raw.slice(0, 300),
      }
    }
  }

  private async enrichCompanyIntel(
    experience: { title: string; company: string; duration: string; description: string }[],
    onProgress?: ProgressCallback
  ): Promise<CompanyIntel[]> {
    const companies = [...new Set(experience.map((e) => e.company).filter(Boolean))]
    this.logger.log(`Company intel: checking ${companies.length} companies`)
    onProgress?.(`[CompanyIntel] Researching ${companies.length} companies`)

    const results: CompanyIntel[] = []

    for (const company of companies.slice(0, 5)) {
      this.logger.log(`Company intel: ${company}`)
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${company}" company website`)}`
      const raw = await this.tinyfish.crawl(
        searchUrl,
        `Research the company "${company}" thoroughly across the web.\n\n` +
          'STEP 1: Look at the Google search results for initial info.\n' +
          'STEP 2: Visit the company official website (if found) and gather details.\n' +
          'STEP 3: Search for additional sources — try:\n' +
          `  - "${company}" glassdoor\n` +
          `  - "${company}" linkedin company page\n` +
          `  - "${company}" crunchbase\n` +
          'STEP 4: Visit 1-2 more relevant results to verify and enrich data.\n\n' +
          'Extract and return as JSON:\n' +
          '- url (string|null): the company official website URL\n' +
          '- exists (boolean): is this a real, active company?\n' +
          '- industry (string|null): industry sector\n' +
          '- techStack (string[]): technologies used (languages, frameworks, cloud providers)\n' +
          '- size (string|null): company size (e.g. "50-200", "startup", "enterprise")\n' +
          '- founded (string|null): year founded if available\n' +
          '- headquarters (string|null): location if available\n' +
          '- summary (string): 3-4 sentence comprehensive description\n',
        { browserProfile: 'lite', label: `CompanyIntel: ${company}`, onProgress, timeoutMs: 300_000 }
      )

      if (!raw) {
        results.push({
          company,
          url: null,
          exists: false,
          industry: null,
          techStack: [],
          size: null,
          founded: null,
          headquarters: null,
          summary: 'Could not verify',
        })
        continue
      }

      try {
        const data = JSON.parse(raw)
        results.push({
          company,
          url: data.url || null,
          exists: data.exists ?? true,
          industry: data.industry || null,
          techStack: data.techStack || [],
          size: data.size || null,
          founded: data.founded || null,
          headquarters: data.headquarters || null,
          summary: data.summary || '',
        })
      } catch {
        results.push({
          company,
          url: null,
          exists: true,
          industry: null,
          techStack: [],
          size: null,
          founded: null,
          headquarters: null,
          summary: raw.slice(0, 300),
        })
      }
    }

    onProgress?.(`[CompanyIntel] Done: ${results.length} companies researched`)
    return results
  }

  private async enrichStackOverflow(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<StackOverflowProfile | null> {
    this.logger.log(`Stack Overflow analysis: ${url}`)
    const raw = await this.tinyfish.crawl(
      url,
      'Visit this Stack Overflow profile page. Extract:\n' +
        '- reputation (number)\n' +
        '- badges: {gold: number, silver: number, bronze: number}\n' +
        '- topTags (array of {name, score}): top 5 tags by score\n' +
        '- answerCount (number): total answers\n' +
        '- summary (string): 2-3 sentence assessment of their SO activity\n' +
        'Return as JSON.',
      { label: 'StackOverflow', onProgress }
    )

    if (!raw) return null

    try {
      const data = JSON.parse(raw)
      return {
        url,
        reputation: data.reputation || 0,
        badges: data.badges || { gold: 0, silver: 0, bronze: 0 },
        topTags: (data.topTags || []).map((t: Record<string, unknown>) => ({
          name: String(t.name || ''),
          score: Number(t.score || 0),
        })),
        answerCount: data.answerCount || 0,
        summary: data.summary || '',
      }
    } catch {
      return {
        url,
        reputation: 0,
        badges: { gold: 0, silver: 0, bronze: 0 },
        topTags: [],
        answerCount: 0,
        summary: raw.slice(0, 300),
      }
    }
  }
}
