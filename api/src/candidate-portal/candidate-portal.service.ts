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

    const resources: LearningResource[] = []

    // Step 1: OpenAI generates targeted search queries from the gap description
    const queries = await this.generateSearchQueries(skill)
    onProgress?.(`[AI] Analyzing gap: "${skill}" → searching for "${queries.devtoQuery}"`)

    // Search dev.to for blog posts — using AI-generated query
    const devToUrl = `https://dev.to/search?q=${encodeURIComponent(queries.devtoQuery)}`
    onProgress?.(`[dev.to] Searching tutorials for: ${queries.devtoQuery}`)
    const devToResult = await this.tinyFishCrawl.crawl(
      devToUrl,
      `Search for the top 3 most relevant blog posts/tutorials about "${queries.coreTech}".
For each result, click into the actual article page and extract:
1. The exact article title
2. The actual URL (must be https://dev.to/username/article-slug, NOT a search URL)
3. A brief factual description of the article content (2-3 sentences)
4. The main topics covered

Return JSON array:
[{"title": "exact title", "url": "https://dev.to/...", "description": "factual description", "topics": ["topic1", "topic2"]}]`,
      {
        label: `dev.to/${queries.coreTech}`,
        onProgress,
        browserProfile: 'lite',
        timeoutMs: 360_000,
      }
    )

    if (devToResult) {
      try {
        const parsed = this.parseResourceJson(devToResult)
        for (const item of parsed) {
          const url = item.url && item.url.includes('dev.to/') && !item.url.includes('/search?')
            ? item.url
            : `https://dev.to/search?q=${encodeURIComponent(queries.devtoQuery)}`
          resources.push({
            title: item.title || `${queries.coreTech} tutorial`,
            url,
            source: 'dev.to',
            type: 'blog',
            description: item.description || '',
            skill,
            summary: '',
            keyTakeaways: [],
          })
        }
      } catch {
        this.logger.warn(`Failed to parse dev.to results for ${skill}`)
      }
    }

    onProgress?.(`Found ${resources.length} articles on dev.to for ${queries.coreTech}`)

    // Search GitHub for educational repos — using AI-generated query
    const githubUrl = `https://github.com/search?q=${encodeURIComponent(queries.githubQuery)}&type=repositories&s=stars`
    onProgress?.(`[GitHub] Searching repositories for: ${queries.githubQuery}`)
    const githubResult = await this.tinyFishCrawl.crawl(
      githubUrl,
      `Find the top 3 most popular GitHub repositories for learning "${queries.coreTech}".
For each, click into the repository and extract:
1. The repository name (owner/repo format)
2. The actual URL (must be https://github.com/owner/repo)
3. A factual description of what the repo contains
4. Key technologies and concepts covered

Return JSON array:
[{"title": "owner/repo", "url": "https://github.com/owner/repo", "description": "factual description", "topics": ["topic1", "topic2"]}]`,
      {
        label: `github/${queries.coreTech}`,
        onProgress,
        browserProfile: 'lite',
        timeoutMs: 360_000,
      }
    )

    if (githubResult) {
      try {
        const parsed = this.parseResourceJson(githubResult)
        for (const item of parsed) {
          const url = item.url && item.url.includes('github.com/') && !item.url.includes('/search?')
            ? item.url
            : `https://github.com/search?q=${encodeURIComponent(skill)}`
          resources.push({
            title: item.title || `${skill} project`,
            url,
            source: 'github.com',
            type: 'project',
            description: item.description || '',
            skill,
            summary: '',
            keyTakeaways: [],
          })
        }
      } catch {
        this.logger.warn(`Failed to parse GitHub results for ${skill}`)
      }
    }

    onProgress?.(`Found ${resources.length} total resources for ${skill}`)

    // Synthesize mentor advice with OpenAI
    const enrichedResources = await this.synthesizeWithOpenAI(skill, resources, onProgress)

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

  private async synthesizeWithOpenAI(
    skill: string,
    resources: LearningResource[],
    onProgress?: (msg: string) => void
  ): Promise<LearningResource[]> {
    if (resources.length === 0) return resources

    onProgress?.(`[AI Mentor] Generating learning advice for ${skill}...`)

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const resourceDescriptions = resources.map((r, i) =>
        `${i + 1}. [${r.source}/${r.type}] "${r.title}" — ${r.description}`
      ).join('\n')

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an experienced software engineering mentor. A developer needs to learn "${skill}". Based on the resources found, provide personalized learning guidance. Be specific, practical, and encouraging.`
          },
          {
            role: 'user',
            content: `Here are learning resources found for "${skill}":\n\n${resourceDescriptions}\n\nFor EACH resource, provide:\n1. A mentor-style summary (2-3 sentences explaining why this resource is valuable and how the developer should approach it)\n2. 2-3 specific key takeaways the developer will gain\n\nReturn JSON array matching the resource order:\n[{"summary": "...", "keyTakeaways": ["...", "...", "..."]}]`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      })

      const content = response.choices[0]?.message?.content || ''
      // Parse the JSON response
      let mentorData: Array<{ summary?: string; keyTakeaways?: string[] }> = []
      try {
        const match = content.match(/\[[\s\S]*\]/)
        if (match) {
          mentorData = JSON.parse(match[0])
        }
      } catch {
        this.logger.warn('Failed to parse OpenAI mentor response')
      }

      // Merge mentor data into resources
      return resources.map((r, i) => ({
        ...r,
        summary: mentorData[i]?.summary || r.description,
        keyTakeaways: mentorData[i]?.keyTakeaways || [],
      }))
    } catch (err) {
      this.logger.warn(`OpenAI synthesis failed: ${err}`)
      // Fallback: use descriptions as summaries
      return resources.map(r => ({
        ...r,
        summary: r.description,
        keyTakeaways: [],
      }))
    }
  }

  private parseResourceJson(raw: string): Array<{ title?: string; url?: string; description?: string }> {
    try {
      // Try parsing directly
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
      if (parsed.resources) return parsed.resources
      if (parsed.results) return parsed.results
      if (parsed.items) return parsed.items
      return [parsed]
    } catch {
      // Try to extract JSON array from the text
      const match = raw.match(/\[[\s\S]*?\]/)?.[0]
      if (match) {
        try {
          return JSON.parse(match)
        } catch {
          return []
        }
      }
      return []
    }
  }
}
