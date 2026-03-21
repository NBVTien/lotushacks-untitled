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
    },
    existing: ExtendedEnrichment | null,
    onProgress?: ProgressCallback,
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
        this.enrichLinkedIn(context.linkedinUrl, onProgress).then((r) => { result._linkedin = r }),
      )
    }

    if (types.includes('portfolio') && context.portfolioUrls.length > 0) {
      tasks.push(
        this.enrichPortfolio(context.portfolioUrls[0], onProgress).then((r) => { result.portfolio = r }),
      )
    }

    if (types.includes('liveProjects') && context.projectUrls.length > 0) {
      tasks.push(
        this.enrichLiveProjects(context.projectUrls.slice(0, 3), onProgress).then((r) => { result.liveProjects = r }),
      )
    }

    if (types.includes('blog') && context.blogUrls.length > 0) {
      tasks.push(
        this.enrichBlog(context.blogUrls[0], onProgress).then((r) => { result.blog = r }),
      )
    }

    if (types.includes('stackoverflow') && context.stackoverflowUrl) {
      tasks.push(
        this.enrichStackOverflow(context.stackoverflowUrl, onProgress).then((r) => { result.stackoverflow = r }),
      )
    }

    await Promise.all(tasks)
    return result
  }

  private async enrichLinkedIn(url: string, onProgress?: ProgressCallback): Promise<LinkedInProfile | null> {
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
    onProgress?.(`[LinkedIn] Done: ${result.experience.length} experiences, ${result.skills.length} skills`)
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

  private async enrichPortfolio(url: string, onProgress?: ProgressCallback): Promise<PortfolioAnalysis | null> {
    this.logger.log(`Portfolio analysis: ${url}`)
    const raw = await this.tinyfish.crawl(url,
      'Visit this personal portfolio/website. Analyze it and return JSON:\n' +
      '- isOnline (boolean): does the page load successfully?\n' +
      '- techStack (string[]): detected technologies (React, WordPress, Next.js, etc.)\n' +
      '- designQuality (string): "professional", "good", "basic", or "template"\n' +
      '- hasResponsive (boolean): does it look good on mobile? (check viewport)\n' +
      '- summary (string): 2-3 sentence description of the website, what it showcases\n' +
      '- sections (string[]): list main sections/pages visible',
      { label: 'Portfolio', onProgress },
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
      return { url, isOnline: true, techStack: [], designQuality: 'unknown', hasResponsive: false, summary: raw.slice(0, 500) }
    }
  }

  private async enrichLiveProjects(urls: string[], onProgress?: ProgressCallback): Promise<LiveProjectCheck[]> {
    const results: LiveProjectCheck[] = []

    for (const url of urls) {
      this.logger.log(`Live project check: ${url}`)
      const raw = await this.tinyfish.crawl(url,
        'Visit this web application/project. Check if it works and analyze it. Return JSON:\n' +
        '- isOnline (boolean): does the app load?\n' +
        '- techDetected (string[]): technologies visible (React, Vue, Angular, etc.)\n' +
        '- uiQuality (string): "polished", "functional", "basic", or "broken"\n' +
        '- features (string[]): list main features/pages you can see\n' +
        '- summary (string): 2-3 sentence description of what this app does and its quality',
        { label: `Project: ${url}`, onProgress },
      )

      if (!raw) {
        results.push({ url, name: url, isOnline: false, techDetected: [], uiQuality: 'unknown', features: [], summary: 'Could not access' })
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
        results.push({ url, name: url, isOnline: true, techDetected: [], uiQuality: 'unknown', features: [], summary: raw.slice(0, 300) })
      }
    }

    return results
  }

  private async enrichBlog(url: string, onProgress?: ProgressCallback): Promise<BlogAnalysis | null> {
    this.logger.log(`Blog analysis: ${url}`)
    const raw = await this.tinyfish.crawl(url,
      'Visit this developer blog/profile page. Extract:\n' +
      '- platform (string): "dev.to", "medium", "hashnode", "personal", etc.\n' +
      '- totalPosts (number): how many posts visible or stated\n' +
      '- recentPosts (array of {title, date, tags}): last 5 posts\n' +
      '- topicFocus (string[]): main topics the author writes about\n' +
      '- writingQuality (string): "excellent", "good", "basic"\n' +
      '- summary (string): 2-3 sentence assessment of their technical writing\n' +
      'Return as JSON.',
      { label: 'Blog', onProgress },
    )

    if (!raw) return null

    try {
      const data = JSON.parse(raw)
      return {
        platform: data.platform || 'unknown',
        url,
        totalPosts: data.totalPosts || 0,
        recentPosts: (data.recentPosts || []).map((p: Record<string, unknown>) => ({
          title: String(p.title || ''), date: String(p.date || ''), tags: (p.tags as string[]) || [],
        })),
        topicFocus: data.topicFocus || [],
        writingQuality: data.writingQuality || 'unknown',
        summary: data.summary || '',
      }
    } catch {
      return { platform: 'unknown', url, totalPosts: 0, recentPosts: [], topicFocus: [], writingQuality: 'unknown', summary: raw.slice(0, 300) }
    }
  }

  private async enrichStackOverflow(url: string, onProgress?: ProgressCallback): Promise<StackOverflowProfile | null> {
    this.logger.log(`Stack Overflow analysis: ${url}`)
    const raw = await this.tinyfish.crawl(url,
      'Visit this Stack Overflow profile page. Extract:\n' +
      '- reputation (number)\n' +
      '- badges: {gold: number, silver: number, bronze: number}\n' +
      '- topTags (array of {name, score}): top 5 tags by score\n' +
      '- answerCount (number): total answers\n' +
      '- summary (string): 2-3 sentence assessment of their SO activity\n' +
      'Return as JSON.',
      { label: 'StackOverflow', onProgress },
    )

    if (!raw) return null

    try {
      const data = JSON.parse(raw)
      return {
        url,
        reputation: data.reputation || 0,
        badges: data.badges || { gold: 0, silver: 0, bronze: 0 },
        topTags: (data.topTags || []).map((t: Record<string, unknown>) => ({
          name: String(t.name || ''), score: Number(t.score || 0),
        })),
        answerCount: data.answerCount || 0,
        summary: data.summary || '',
      }
    } catch {
      return { url, reputation: 0, badges: { gold: 0, silver: 0, bronze: 0 }, topTags: [], answerCount: 0, summary: raw.slice(0, 300) }
    }
  }

}
