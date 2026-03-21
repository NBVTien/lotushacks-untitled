import { Injectable, Logger } from '@nestjs/common'
import type { ExtractedLinks, EnrichedProfile, LinkedInProfile } from '@lotushack/shared'
import { GitHubApiService } from './github-api.service'
import { TinyFishCrawlService, type ProgressCallback } from './tinyfish-crawl.service'

export { type ProgressCallback } from './tinyfish-crawl.service'

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name)

  constructor(
    private readonly githubApi: GitHubApiService,
    private readonly tinyfish: TinyFishCrawlService,
  ) {}

  async enrich(links: ExtractedLinks, onProgress?: ProgressCallback): Promise<EnrichedProfile> {
    let [github, linkedin] = await Promise.all([
      links.github ? this.githubApi.enrichGitHub(links.github, onProgress) : Promise.resolve(null),
      links.linkedin ? this.enrichLinkedIn(links.linkedin, onProgress) : Promise.resolve(null),
    ])

    // Fix: if LinkedIn result is empty but raw contains GitHub data, rescue it
    if (linkedin && !linkedin.headline && !linkedin.experience.length && linkedin.raw) {
      try {
        const rawData = JSON.parse(linkedin.raw)
        if (rawData.repositories || rawData.top_languages) {
          this.logger.warn('LinkedIn crawl returned GitHub data — rescuing')
          onProgress?.('[LinkedIn] Received GitHub data instead — using as GitHub profile')
          if (!github) {
            const username = links.github?.replace(/\/$/, '').split('/').pop() || rawData.username || ''
            github = {
              username,
              bio: rawData.bio || null,
              topLanguages: rawData.top_languages || [],
              repositories: (rawData.repositories || []).slice(0, 10).map((r: Record<string, unknown>) => ({
                name: String(r.name || ''), description: r.description ? String(r.description) : null,
                language: r.language ? String(r.language) : null, stars: Number(r.stars || 0),
              })),
              totalStars: Number(rawData.total_stars || 0),
              totalContributions: rawData.total_contributions ?? null,
              raw: linkedin.raw,
            }
          }
          linkedin = null
        }
      } catch { /* not JSON */ }
    }

    return { github, linkedin }
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
}
