import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { GitHubProfile, RepoSummary } from '@lotushack/shared'
import type { ProgressCallback } from './enrichment.service'

interface GitHubRepoAPI {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  fork: boolean
  updated_at: string
  html_url: string
  default_branch: string
  topics: string[]
  size: number
}

interface RepoAnalysis {
  name: string
  description: string | null
  language: string | null
  stars: number
  url: string
  languages: Record<string, number>
  readmeSnippet: string | null
  recentCommits: number
  analysis: string | null
}

@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name)
  private readonly openai: OpenAI

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY', '') })
  }

  async enrichGitHub(url: string, onProgress?: ProgressCallback): Promise<GitHubProfile | null> {
    const username = url.replace(/\/$/, '').split('/').pop()
    if (!username) return null

    this.logger.log(`GitHub API enrichment for @${username}`)
    onProgress?.(`[GitHub] Fetching profile via API: @${username}`)

    try {
      // 1. Fetch user profile
      const profile = await this.fetchJSON(`https://api.github.com/users/${username}`)
      if (!profile) {
        onProgress?.('[GitHub] User not found')
        return null
      }
      onProgress?.(`[GitHub] Profile: ${profile.name || username}, ${profile.public_repos} repos`)

      // 2. Fetch repos (sorted by recently updated, exclude forks)
      const allRepos: GitHubRepoAPI[] = await this.fetchJSON(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=30`,
      ) || []
      const ownRepos = allRepos.filter((r) => !r.fork)
      onProgress?.(`[GitHub] Found ${ownRepos.length} non-fork repos`)

      // 3. Pick top 3 most active repos for deep analysis
      const topRepos = ownRepos.slice(0, 3)
      const analyses: RepoAnalysis[] = []

      for (const repo of topRepos) {
        onProgress?.(`[GitHub] Analyzing repo: ${repo.name}...`)
        const analysis = await this.analyzeRepo(username, repo)
        analyses.push(analysis)
      }

      // 4. Build summary repos list (top 10)
      const repositories: RepoSummary[] = ownRepos.slice(0, 10).map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
      }))

      // 5. Calculate stats
      const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0)
      const allLanguages = ownRepos.map((r) => r.language).filter(Boolean) as string[]
      const langCount: Record<string, number> = {}
      for (const lang of allLanguages) {
        langCount[lang] = (langCount[lang] || 0) + 1
      }
      const topLanguages = Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([lang]) => lang)

      // 6. AI analysis of top repos (returns overall summary + per-project analysis)
      onProgress?.('[GitHub] AI analyzing top projects...')
      const aiResult = await this.aiAnalyzeProjects(username, profile, analyses)
      // Merge per-project analyses back
      for (const a of analyses) {
        a.analysis = aiResult.projects[a.name] || null
      }
      onProgress?.(`[GitHub] Done: ${topLanguages.join(', ')}, ${totalStars} stars, ${analyses.length} projects analyzed`)

      // 7. Build raw as detailed JSON for scoring
      const detailedRaw = JSON.stringify({
        username,
        bio: profile.bio,
        name: profile.name,
        company: profile.company,
        location: profile.location,
        publicRepos: profile.public_repos,
        followers: profile.followers,
        topLanguages,
        totalStars,
        totalContributions: null,
        topProjects: analyses.map((a) => ({
          name: a.name,
          description: a.description,
          language: a.language,
          stars: a.stars,
          url: a.url,
          languages: a.languages,
          recentCommits: a.recentCommits,
          readmeSnippet: a.readmeSnippet?.slice(0, 500),
          analysis: a.analysis,
        })),
        aiSummary: aiResult.summary,
      })

      return {
        username,
        bio: profile.bio || null,
        topLanguages,
        repositories,
        totalStars,
        totalContributions: null,
        raw: detailedRaw,
      }
    } catch (err) {
      this.logger.error(`GitHub API error for @${username}:`, err)
      onProgress?.(`[GitHub] API error: ${err instanceof Error ? err.message : 'unknown'}`)
      return null
    }
  }

  private async analyzeRepo(username: string, repo: GitHubRepoAPI): Promise<RepoAnalysis> {
    // Fetch languages
    const languages: Record<string, number> = await this.fetchJSON(
      `https://api.github.com/repos/${username}/${repo.name}/languages`,
    ) || {}

    // Fetch README
    let readmeSnippet: string | null = null
    try {
      const readmeData = await this.fetchJSON(
        `https://api.github.com/repos/${username}/${repo.name}/readme`,
      )
      if (readmeData?.content) {
        const decoded = Buffer.from(readmeData.content, 'base64').toString('utf-8')
        readmeSnippet = decoded.slice(0, 2000)
      }
    } catch { /* no readme */ }

    // Fetch recent commit count (last 30 days)
    let recentCommits = 0
    try {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const commits: unknown[] = await this.fetchJSON(
        `https://api.github.com/repos/${username}/${repo.name}/commits?since=${since}&per_page=100`,
      ) || []
      recentCommits = commits.length
    } catch { /* ok */ }

    return {
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      url: repo.html_url,
      languages,
      readmeSnippet,
      recentCommits,
      analysis: null,
    }
  }

  private async aiAnalyzeProjects(
    username: string,
    profile: Record<string, unknown>,
    repos: RepoAnalysis[],
  ): Promise<{ summary: string; projects: Record<string, string> }> {
    if (repos.length === 0) return { summary: 'No repos to analyze', projects: {} }

    let prompt = `Analyze this GitHub developer's top projects:\n\n`
    prompt += `Developer: @${username}\n`
    if (profile.bio) prompt += `Bio: ${profile.bio}\n`
    if (profile.company) prompt += `Company: ${profile.company}\n`
    prompt += `Public repos: ${profile.public_repos}, Followers: ${profile.followers}\n\n`

    for (const repo of repos) {
      prompt += `## ${repo.name}\n`
      prompt += `Language: ${repo.language || 'N/A'} | Stars: ${repo.stars} | Recent commits (90d): ${repo.recentCommits}\n`
      prompt += `Languages used: ${Object.keys(repo.languages).join(', ') || 'N/A'}\n`
      if (repo.description) prompt += `Description: ${repo.description}\n`
      if (repo.readmeSnippet) prompt += `README:\n${repo.readmeSnippet.slice(0, 800)}\n`
      prompt += '\n'
    }

    prompt += `\nReturn a JSON object with:\n`
    prompt += `- "summary" (string): 3-5 sentence overall assessment of this developer's skills, tech stack depth, code activity level, and project quality\n`
    prompt += `- "projects" (object): for each repo name as key, provide a 2-3 sentence analysis of that specific project — what it demonstrates about the developer's skills, strengths, and areas for improvement\n`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a technical recruiter analyzing a developer\'s GitHub projects. Be concise, specific, and evidence-based. Return JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000,
      })
      const content = response.choices[0]?.message?.content
      if (!content) return { summary: 'Analysis unavailable', projects: {} }
      const parsed = JSON.parse(content)
      return {
        summary: parsed.summary || 'Analysis unavailable',
        projects: parsed.projects || {},
      }
    } catch {
      return { summary: 'AI analysis failed', projects: {} }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async fetchJSON(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'recruitment-copilot',
        },
      })
      if (!response.ok) {
        if (response.status === 403) this.logger.warn(`GitHub API rate limited: ${url}`)
        return null
      }
      return await response.json()
    } catch {
      return null
    }
  }
}
