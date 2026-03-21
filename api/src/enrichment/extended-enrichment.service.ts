import { Injectable, Logger } from '@nestjs/common'
import { TinyFishCrawlService, type ProgressCallback } from './tinyfish-crawl.service'
import type {
  ExtendedEnrichment,
  ExtendedEnrichmentType,
  PortfolioAnalysis,
  LiveProjectCheck,
  BlogAnalysis,
  StackOverflowProfile,
  WorkVerification,
  ParsedCVData,
} from '@lotushack/shared'

@Injectable()
export class ExtendedEnrichmentService {
  private readonly logger = new Logger(ExtendedEnrichmentService.name)

  constructor(private readonly tinyfish: TinyFishCrawlService) {}

  async enrich(
    types: ExtendedEnrichmentType[],
    context: {
      portfolioUrls: string[]
      projectUrls: string[]
      blogUrls: string[]
      stackoverflowUrl: string | null
      parsedCV: ParsedCVData | null
    },
    existing: ExtendedEnrichment | null,
    onProgress?: ProgressCallback,
  ): Promise<ExtendedEnrichment> {
    const result: ExtendedEnrichment = existing || {
      portfolio: null,
      liveProjects: [],
      blog: null,
      stackoverflow: null,
      verification: [],
    }

    const tasks: Promise<void>[] = []

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

    if (types.includes('verification') && context.parsedCV?.experience?.length) {
      tasks.push(
        this.verifyWork(context.parsedCV.experience.slice(0, 3), onProgress).then((r) => { result.verification = r }),
      )
    }

    await Promise.all(tasks)
    return result
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

  private async verifyWork(
    experience: { title: string; company: string; duration: string; description: string }[],
    onProgress?: ProgressCallback,
  ): Promise<WorkVerification[]> {
    const results: WorkVerification[] = []

    for (const exp of experience) {
      if (!exp.company || exp.company === 'Self-employed' || exp.company === 'Freelance') continue
      this.logger.log(`Verifying work: ${exp.company}`)

      const raw = await this.tinyfish.crawl(
        `https://www.google.com/search?q=${encodeURIComponent(`"${exp.company}" company`)}`,
        `Search for the company "${exp.company}". Then:\n` +
        '1. Visit the company website (if found)\n' +
        '2. Look for About/Team/People page\n' +
        `3. Check if there is any mention of the role "${exp.title}"\n` +
        '4. Return JSON:\n' +
        '- verified (boolean|null): true if evidence found, false if contradicted, null if inconclusive\n' +
        '- evidence (string): what you found\n' +
        '- companyUrl (string|null): the company website URL',
        { label: `Verify: ${exp.company}`, onProgress },
      )

      if (!raw) {
        results.push({ company: exp.company, claimed: `${exp.title} (${exp.duration})`, verified: null, evidence: 'Could not verify', companyUrl: null })
        continue
      }

      try {
        const data = JSON.parse(raw)
        results.push({
          company: exp.company,
          claimed: `${exp.title} (${exp.duration})`,
          verified: data.verified ?? null,
          evidence: data.evidence || 'No evidence found',
          companyUrl: data.companyUrl || null,
        })
      } catch {
        results.push({ company: exp.company, claimed: `${exp.title} (${exp.duration})`, verified: null, evidence: raw.slice(0, 300), companyUrl: null })
      }
    }

    return results
  }
}
