import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { v4 as uuid } from 'uuid'
import OpenAI from 'openai'
import { UserEntity, SavedJdEntity } from '../database'
import { PdfService } from '../candidates/pdf.service'
import { MatchingService } from '../matching/matching.service'
import { TinyFishCrawlService } from '../enrichment/tinyfish-crawl.service'
import type {
  CreateSavedJDDto,
  GapAnalysis,
  ImprovementArea,
  ParsedCVData,
  LearningResource,
  LearningResourceResult,
} from '@lotushack/shared'

@Injectable()
export class CandidatePortalService {
  private readonly logger = new Logger(CandidatePortalService.name)

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SavedJdEntity)
    private readonly savedJdRepo: Repository<SavedJdEntity>,
    private readonly pdfService: PdfService,
    private readonly matchingService: MatchingService,
    private readonly tinyFishCrawl: TinyFishCrawlService
  ) {}

  async uploadCv(userId: string, file: Express.Multer.File) {
    this.logger.log(`Uploading CV for user ${userId}: ${file.originalname}`)

    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    // Parse the PDF using PdfService
    const parsed = await this.pdfService.parseCV(file.buffer, file.originalname)

    // Build ParsedCVData from the parsed result
    const parsedCV: ParsedCVData = {
      summary: parsed.summary,
      skills: parsed.skills,
      experience: parsed.experience,
      education: parsed.education,
    }

    // Update user with CV data
    user.cvText = parsed.rawText
    user.parsedCV = parsedCV as unknown as Record<string, unknown>
    await this.userRepo.save(user)

    this.logger.log(
      `CV uploaded for user ${userId}: skills=${parsed.skills.length}, ` +
      `experience=${parsed.experience.length}, education=${parsed.education.length}`
    )

    return {
      cvText: parsed.rawText,
      parsedCV,
      name: parsed.name,
      email: parsed.email,
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['company'] })
    if (!user) throw new NotFoundException('User not found')

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      cvText: user.cvText,
      parsedCV: user.parsedCV as unknown as ParsedCVData | null,
      createdAt: user.createdAt,
    }
  }

  async saveJd(userId: string, dto: CreateSavedJDDto) {
    this.logger.log(`Saving JD for user ${userId}: "${dto.title}"`)

    const savedJd = this.savedJdRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      source: 'pasted',
      jobId: dto.jobId || null,
    })

    return this.savedJdRepo.save(savedJd)
  }

  async listSavedJds(userId: string) {
    return this.savedJdRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    })
  }

  async deleteSavedJd(userId: string, id: string) {
    const jd = await this.savedJdRepo.findOne({ where: { id, userId } })
    if (!jd) throw new NotFoundException('Saved JD not found')
    await this.savedJdRepo.delete(id)
    return { deleted: true }
  }

  async analyzeGap(userId: string, savedJdId: string): Promise<GapAnalysis> {
    this.logger.log(`Analyzing gap for user ${userId}, JD ${savedJdId}`)

    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (!user.cvText) throw new BadRequestException('Please upload your CV first')

    const savedJd = await this.savedJdRepo.findOne({ where: { id: savedJdId, userId } })
    if (!savedJd) throw new NotFoundException('Saved JD not found')

    // Use MatchingService to score CV against JD
    const matchResult = await this.matchingService.score(
      {
        cvText: user.cvText,
        parsedCV: user.parsedCV,
        enrichment: null,
      },
      {
        description: savedJd.description,
        requirements: savedJd.requirements,
        screeningCriteria: null,
      }
    )

    // Extract improvement areas from skill scores
    const improvementAreas: ImprovementArea[] = []
    if (matchResult.skillScores) {
      for (const skill of matchResult.skillScores) {
        if (skill.level === 'no' || skill.level === 'partial') {
          improvementAreas.push({
            skill: skill.name,
            currentLevel: skill.level,
            priority: skill.level === 'no' ? 'high' : 'medium',
            description: skill.evidence,
          })
        }
      }
    }

    // Also add gaps as improvement areas if not already covered
    for (const gap of matchResult.gaps) {
      const alreadyCovered = improvementAreas.some(
        (a) => gap.toLowerCase().includes(a.skill.toLowerCase())
      )
      if (!alreadyCovered) {
        improvementAreas.push({
          skill: gap,
          currentLevel: 'no',
          priority: 'medium',
          description: gap,
        })
      }
    }

    const gapAnalysis: GapAnalysis = {
      id: uuid(),
      userId,
      savedJdId,
      overallScore: matchResult.overallScore,
      explanation: matchResult.explanation,
      strengths: matchResult.strengths,
      gaps: matchResult.gaps,
      recommendation: matchResult.recommendation,
      improvementAreas,
      skillScores: matchResult.skillScores || [],
      createdAt: new Date().toISOString(),
    }

    savedJd.lastAnalysis = gapAnalysis as unknown as Record<string, unknown>
    await this.savedJdRepo.save(savedJd)

    this.logger.log(
      `Gap analysis complete: score=${matchResult.overallScore}, ` +
      `improvements=${improvementAreas.length}, gaps=${matchResult.gaps.length}`
    )

    return gapAnalysis
  }

  async getCachedResources(userId: string, savedJdId: string): Promise<LearningResourceResult[] | null> {
    const savedJd = await this.savedJdRepo.findOne({ where: { id: savedJdId, userId } })
    if (!savedJd?.lastResources) return null
    return savedJd.lastResources as unknown as LearningResourceResult[]
  }

  async getCachedResourcesForSkill(userId: string, savedJdId: string, skill: string): Promise<LearningResourceResult | null> {
    const savedJd = await this.savedJdRepo.findOne({ where: { id: savedJdId, userId } })
    if (!savedJd?.lastResources) return null
    const resources = savedJd.lastResources as unknown as LearningResourceResult[]
    return resources.find(r => r.skill === skill) || null
  }

  private async generateSearchQueries(skill: string): Promise<{ devtoQuery: string; githubQuery: string; coreTech: string }> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a tech learning advisor. Given a skill gap, generate optimal search queries to find learning resources.'
          },
          {
            role: 'user',
            content: `A developer has this skill gap: "${skill}"

Generate two search queries:
1. A dev.to search query to find the best tutorial/guide articles (2-4 words, focus on the core technology)
2. A GitHub search query to find the best learning repositories (2-4 words, focus on examples/tutorials)

Return JSON: {"devtoQuery": "...", "githubQuery": "...", "coreTech": "the core technology name"}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      })

      const content = response.choices[0]?.message?.content || ''
      try {
        const match = content.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
      } catch {
        // fall through to fallback
      }
    } catch (err) {
      this.logger.warn(`Failed to generate search queries: ${err}`)
    }

    // Fallback: extract key tech terms
    return { devtoQuery: skill, githubQuery: skill + ' tutorial example', coreTech: skill }
  }

  async discoverResourcesForSkill(
    skill: string,
    onProgress?: (msg: string) => void,
    saveTarget?: { userId: string; savedJdId: string }
  ): Promise<LearningResourceResult> {
    this.logger.log(`Discovering mentor resources for skill: ${skill}`)

    if (!this.tinyFishCrawl.isConfigured) {
      onProgress?.('TinyFish API not configured')
      return { skill, resources: [], searchedAt: new Date().toISOString() }
    }

    // Step 1: OpenAI generates targeted search queries from the gap description
    const queries = await this.generateSearchQueries(skill)
    onProgress?.(`[AI] Analyzing gap: "${skill}" → searching for "${queries.coreTech}"`)

    // Step 2: TinyFish crawls — collect RAW text results
    const rawResults: { source: string; data: string }[] = []

    // Search dev.to
    const devToUrl = `https://dev.to/search?q=${encodeURIComponent(queries.devtoQuery)}`
    onProgress?.(`[dev.to] Searching tutorials for: ${queries.devtoQuery}`)
    const devToResult = await this.tinyFishCrawl.crawl(
      devToUrl,
      `Search for the top 3 most relevant blog posts/tutorials about "${queries.coreTech}".
For each result found, extract: the exact article title, the full URL, and a 2-3 sentence description of what the article covers.
Return all information you find — raw text or JSON, either is fine.`,
      {
        label: `dev.to/${queries.coreTech}`,
        onProgress,
        browserProfile: 'lite',
        timeoutMs: 360_000,
      }
    )
    if (devToResult) {
      rawResults.push({ source: 'dev.to', data: devToResult })
      this.logger.log(`dev.to raw result (${devToResult.length} chars)`)
    }

    onProgress?.(`[dev.to] Done. Searching GitHub...`)

    // Search GitHub via Google
    const githubGoogleUrl = `https://www.google.com/search?q=site:github.com+${encodeURIComponent(queries.githubQuery)}+tutorial+example`
    onProgress?.(`[GitHub] Searching via Google for: ${queries.githubQuery}`)
    const githubResult = await this.tinyFishCrawl.crawl(
      githubGoogleUrl,
      `Look at the Google search results for GitHub repositories about "${queries.coreTech}".
Click on the top 3 GitHub repository links and extract: the repository name (owner/repo), the full GitHub URL, description, and star count.
Return all information you find — raw text or JSON, either is fine.`,
      {
        label: `github/${queries.coreTech}`,
        onProgress,
        browserProfile: 'stealth',
        timeoutMs: 360_000,
      }
    )
    if (githubResult) {
      rawResults.push({ source: 'github', data: githubResult })
      this.logger.log(`GitHub raw result (${githubResult.length} chars)`)
    }

    onProgress?.(`Found raw data from ${rawResults.length} sources. AI is extracting resources...`)

    // Step 3: Send ALL raw data to OpenAI — let it extract + synthesize in one pass
    const enrichedResources = await this.extractAndSynthesize(skill, queries.coreTech, rawResults, onProgress)

    const result: LearningResourceResult = {
      skill,
      resources: enrichedResources,
      searchedAt: new Date().toISOString(),
    }

    // Persist per-skill results (merge into existing lastResources)
    if (saveTarget) {
      try {
        const savedJd = await this.savedJdRepo.findOne({
          where: { id: saveTarget.savedJdId, userId: saveTarget.userId }
        })
        if (savedJd) {
          const existing = (savedJd.lastResources as unknown as LearningResourceResult[]) || []
          const filtered = existing.filter(r => r.skill !== skill)
          filtered.push(result)
          savedJd.lastResources = filtered as unknown as Record<string, unknown>[]
          await this.savedJdRepo.save(savedJd)
          this.logger.log(`Persisted resources for skill "${skill}" on JD ${saveTarget.savedJdId}`)
        }
      } catch (err) {
        this.logger.warn(`Failed to persist resources: ${err}`)
      }
    }

    return result
  }

  async discoverResources(
    gaps: string[],
    skills: string[],
    onProgress?: (msg: string) => void,
    saveTarget?: { userId: string; savedJdId: string }
  ): Promise<LearningResourceResult[]> {
    this.logger.log(`Discovering resources for ${gaps.length} gaps, ${skills.length} skills`)

    if (!this.tinyFishCrawl.isConfigured) {
      this.logger.warn('TinyFish not configured, returning empty results')
      onProgress?.('TinyFish API not configured — skipping resource discovery')
      return []
    }

    const results: LearningResourceResult[] = []

    // Focus on gap skills (these need improvement)
    const skillsToSearch = gaps.length > 0 ? gaps : skills.slice(0, 5)

    for (const skill of skillsToSearch) {
      onProgress?.(`Searching learning resources for: ${skill}`)
      const resources: LearningResource[] = []

      // Search dev.to for blog posts
      const devToResult = await this.tinyFishCrawl.crawl(
        `https://dev.to/search?q=${encodeURIComponent(skill + ' tutorial')}`,
        `Find the top 3 most relevant blog posts/tutorials about "${skill}". ` +
        `For each result, click through to get the ACTUAL article URL (must be like https://dev.to/username/article-slug, NOT a search URL). ` +
        `Return JSON array: [{"title": "actual article title", "url": "https://dev.to/username/article-slug", "description": "one-sentence summary of what the article teaches"}]`,
        {
          label: `dev.to/${skill}`,
          onProgress,
          browserProfile: 'lite',
          timeoutMs: 360_000,
        }
      )

      if (devToResult) {
        try {
          const parsed = this.parseResourceJson(devToResult)
          for (const item of parsed) {
            resources.push({
              title: item.title || `${skill} tutorial`,
              url: item.url && item.url.includes('dev.to/') && !item.url.includes('/search?') ? item.url : `https://dev.to/search?q=${encodeURIComponent(skill)}`,
              source: 'dev.to',
              type: 'blog',
              description: item.description || '',
              skill,
              summary: (item as Record<string, unknown>).summary as string || item.description || '',
              keyTakeaways: (item as Record<string, unknown>).keyTakeaways as string[] || [],
            })
          }
        } catch {
          this.logger.warn(`Failed to parse dev.to results for ${skill}`)
        }
      }

      onProgress?.(`Found ${resources.length} resources on dev.to for ${skill}`)

      // Search GitHub for project repos
      const githubResult = await this.tinyFishCrawl.crawl(
        `https://github.com/search?q=${encodeURIComponent(skill + ' tutorial example')}&type=repositories&s=stars`,
        `Find the top 3 most popular GitHub repositories for learning "${skill}". ` +
        `For each result, extract the ACTUAL repository URL (must be like https://github.com/owner/repo-name, NOT a search URL). ` +
        `Return JSON array: [{"title": "owner/repo-name", "url": "https://github.com/owner/repo-name", "description": "one-sentence summary of what the repo teaches"}]`,
        {
          label: `github/${skill}`,
          onProgress,
          browserProfile: 'lite',
          timeoutMs: 360_000,
        }
      )

      if (githubResult) {
        try {
          const parsed = this.parseResourceJson(githubResult)
          for (const item of parsed) {
            resources.push({
              title: item.title || `${skill} project`,
              url: item.url && item.url.includes('github.com/') && !item.url.includes('/search?') ? item.url : `https://github.com/search?q=${encodeURIComponent(skill)}`,
              source: 'github.com',
              type: 'project',
              description: item.description || '',
              skill,
              summary: (item as Record<string, unknown>).summary as string || item.description || '',
              keyTakeaways: (item as Record<string, unknown>).keyTakeaways as string[] || [],
            })
          }
        } catch {
          this.logger.warn(`Failed to parse GitHub results for ${skill}`)
        }
      }

      onProgress?.(`Found ${resources.length} total resources for ${skill}`)

      results.push({
        skill,
        resources,
        searchedAt: new Date().toISOString(),
      })
    }

    onProgress?.(`Resource discovery complete: ${results.reduce((sum, r) => sum + r.resources.length, 0)} total resources found`)

    // Persist results to saved JD
    if (saveTarget) {
      try {
        const savedJd = await this.savedJdRepo.findOne({
          where: { id: saveTarget.savedJdId, userId: saveTarget.userId }
        })
        if (savedJd) {
          savedJd.lastResources = results as unknown as Record<string, unknown>[]
          await this.savedJdRepo.save(savedJd)
          this.logger.log(`Persisted ${results.length} resource groups for JD ${saveTarget.savedJdId}`)
        }
      } catch (err) {
        this.logger.warn(`Failed to persist resources: ${err}`)
      }
    }

    return results
  }

  private async extractAndSynthesize(
    skill: string,
    coreTech: string,
    rawResults: { source: string; data: string }[],
    onProgress?: (msg: string) => void
  ): Promise<LearningResource[]> {
    if (rawResults.length === 0) return []

    onProgress?.(`[AI Mentor] Extracting resources and generating advice for ${skill}...`)

    const rawDataBlock = rawResults.map(r =>
      `=== SOURCE: ${r.source} ===\n${r.data.substring(0, 3000)}`
    ).join('\n\n')

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert software engineering mentor. Your job is to extract specific learning resources from raw web crawl data and provide actionable learning advice for each one.

RULES:
- Extract EVERY distinct resource (article, repo, tutorial) found in the raw data
- Each resource MUST have an actual URL (https://...) — never make up URLs
- For GitHub repos, URL must be https://github.com/owner/repo format
- For dev.to articles, URL must be https://dev.to/author/slug format
- Use the EXACT title from the raw data, do not paraphrase
- For each resource, explain specifically what the developer will learn from THAT resource
- Key takeaways must be concrete (e.g. "How to configure a Spark standalone cluster" not "Understanding distributed systems")`
          },
          {
            role: 'user',
            content: `A developer needs to learn "${coreTech}" (gap: "${skill}").

Here is the raw data from web crawling:

${rawDataBlock}

Extract ALL individual resources found above. For EACH resource, provide:
- "title": The exact name/title from the raw data
- "url": The actual URL (must be a real URL from the data, not fabricated)
- "source": "dev.to" or "github.com"
- "type": "blog" for articles, "project" for repos
- "description": 1-sentence factual description from the raw data
- "summary": 2-3 sentences of mentor advice — why this resource is valuable and how to use it. Reference the specific title.
- "keyTakeaways": 3 concrete things the developer will learn from THIS specific resource

Return a JSON array:
[{"title": "...", "url": "...", "source": "...", "type": "...", "description": "...", "summary": "...", "keyTakeaways": ["...", "...", "..."]}]`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      })

      const content = response.choices[0]?.message?.content || ''
      this.logger.debug(`OpenAI extract+synthesize response (${content.length} chars)`)

      let extracted: LearningResource[] = []
      try {
        const match = content.match(/\[[\s\S]*\]/)
        if (match) {
          const parsed = JSON.parse(match[0])
          extracted = parsed.map((item: Record<string, unknown>) => ({
            title: item.title || coreTech,
            url: (item.url as string) || '',
            source: (item.source as string) || 'unknown',
            type: (item.type as string) || 'blog',
            description: (item.description as string) || '',
            skill,
            summary: (item.summary as string) || (item.description as string) || '',
            keyTakeaways: (item.keyTakeaways as string[]) || [],
          }))
        }
      } catch {
        this.logger.warn('Failed to parse OpenAI extract response')
      }

      // Filter out resources without valid URLs
      extracted = extracted.filter(r =>
        r.url && r.url.startsWith('https://') && !r.url.includes('google.com/search')
      )

      onProgress?.(`[AI Mentor] Extracted ${extracted.length} resources with advice`)
      this.logger.log(`Extracted ${extracted.length} resources for "${skill}" from raw data`)

      return extracted
    } catch (err) {
      this.logger.warn(`OpenAI extract+synthesize failed: ${err}`)
      return []
    }
  }

  private parseResourceJson(raw: string): Array<{ title?: string; url?: string; description?: string }> {
    this.logger.debug(`Parsing TinyFish result (${raw.length} chars): ${raw.substring(0, 500)}...`)

    try {
      // Try parsing directly
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        this.logger.log(`Parsed ${parsed.length} resources directly`)
        return parsed
      }
      if (parsed.resources) return parsed.resources
      if (parsed.results) return parsed.results
      if (parsed.items) return parsed.items
      return [parsed]
    } catch {
      // Try to extract the LAST (most complete) JSON array from the text
      const matches = [...raw.matchAll(/\[[\s\S]*?\]/g)]
      if (matches.length > 0) {
        // Try each match from largest to smallest
        const sorted = matches.map(m => m[0]).sort((a, b) => b.length - a.length)
        for (const match of sorted) {
          try {
            const parsed = JSON.parse(match)
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.logger.log(`Extracted ${parsed.length} resources from text`)
              return parsed
            }
          } catch { /* try next */ }
        }
      }
      this.logger.warn(`Could not parse any resources from TinyFish result`)
      return []
    }
  }
}
