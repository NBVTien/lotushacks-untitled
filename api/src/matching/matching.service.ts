import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { EnrichedProfile, InterviewQuestionsResult, MatchResult, ScoringBasis } from '@lotushack/shared'

interface CandidateData {
  cvText: string
  parsedCV: Record<string, unknown> | null
  enrichment: EnrichedProfile | null
}

interface JobData {
  description: string
  requirements: string[]
  screeningCriteria: string | null
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name)
  private readonly openai: OpenAI

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY', ''),
    })
  }

  async score(candidate: CandidateData, job: JobData): Promise<MatchResult> {
    this.logger.log(
      `Scoring: cvText=${candidate.cvText.length} chars, parsedCV=${!!candidate.parsedCV}, enrichment.github=${!!candidate.enrichment?.github}, enrichment.linkedin=${!!candidate.enrichment?.linkedin}`
    )
    this.logger.debug(
      `Job: requirements=${job.requirements.length}, hasScreening=${!!job.screeningCriteria}`
    )

    const prompt = this.buildPrompt(candidate, job)
    this.logger.debug(`Prompt length: ${prompt.length} chars`)

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a recruitment AI that evaluates candidate-job fit. ' +
              'Analyze the candidate profile against job requirements and return a JSON object with: ' +
              'overallScore (0-100), explanation (2-3 paragraphs), ' +
              'strengths (array of strings), gaps (array of strings), ' +
              'recommendation (one of: strong_match, good_match, partial_match, weak_match), ' +
              'improvementTips (array of 3-5 specific, actionable tips for the candidate to improve their profile for this role — ' +
              'each tip should reference concrete actions, e.g. "Add a portfolio project demonstrating React + TypeScript to address the frontend gap" ' +
              'rather than vague advice like "Learn more frontend"), ' +
              'skillScores (array of 6-8 objects for the most important skills from job requirements, each with: ' +
              'name (short skill name, max 15 chars, e.g. "TypeScript", "React", "SQL/DB"), ' +
              'level (one of: "yes" if candidate clearly has this skill, "partial" if some experience but not strong, "no" if missing), ' +
              'evidence (brief 5-15 word reason, e.g. "3 years React in CV, confirmed by 5 GitHub repos" or "Not mentioned in CV or GitHub")). ' +
              'Be strict: only "yes" if there is clear evidence. "partial" means some related experience. "no" means no evidence found.), ' +
              'scoringCriteria (array of strings explaining what specific criteria you used to evaluate, e.g. "Technical skills alignment with 5/7 required technologies", ' +
              '"3+ years relevant experience at similar companies"), ' +
              'limitations (array of strings noting any missing data that limited your assessment, e.g. "No LinkedIn profile available to verify work history", ' +
              '"GitHub profile has no public repositories"). ' +
              '\n\n## Screening Criteria (HIGHEST PRIORITY)\n' +
              'If the recruiter has provided custom screening criteria, these OVERRIDE the default scoring weights. ' +
              'Screening criteria represent the recruiter\'s explicit preferences and must be followed as closely as possible. ' +
              'For example, if the criteria say "90% if candidate worked at CompanyX" and the candidate DID work there, ' +
              'the score MUST be at least 90 regardless of other factors. ' +
              'Screening criteria act as score modifiers — they can dramatically raise or lower the score. ' +
              'Always explain in your response how screening criteria influenced the final score.\n' +
              '\n## Default Scoring Weight Guidelines\n' +
              'When NO screening criteria are provided, apply the following approximate weighting:\n' +
              '- Technical skills alignment with job requirements: 30-40%\n' +
              '- Relevant work experience: 20-30%\n' +
              '- GitHub/external profile signals: 20-30%\n' +
              '- Education and other factors: 10-20%\n' +
              '\n## GitHub Enrichment Weighting (CRITICAL)\n' +
              'GitHub activity is a STRONG signal of real-world coding ability. ' +
              'A candidate with active, well-maintained repos should score 15-25 points higher than one with CV-only data, all else being equal. ' +
              'When evaluating GitHub data, consider:\n' +
              '- Repository quality: well-documented READMEs, meaningful descriptions, clean code structure\n' +
              '- Language diversity: does the candidate work across multiple relevant languages/frameworks?\n' +
              '- Commit recency: recent activity shows active engagement (repos updated in last 3 months are strong signals)\n' +
              '- Stars and community recognition: repos with stars indicate projects others find valuable\n' +
              '- Project complexity and relevance: do the repos demonstrate skills required for the job?\n' +
              'If a GitHub profile exists but has 0 public repos or only trivial forks, treat it as a WEAK signal (almost equivalent to no GitHub).\n' +
              '\n## LinkedIn Enrichment Weighting\n' +
              'LinkedIn data validates and enriches CV claims. Verified experience and endorsements add 5-10 points of confidence.\n' +
              '\n## Explanation Requirements\n' +
              'In the explanation, you MUST explicitly mention:\n' +
              '1. What enrichment data sources were available (GitHub, LinkedIn, or neither)\n' +
              '2. How each available data source influenced your score — what did it confirm, contradict, or add beyond the CV?\n' +
              '3. If no enrichment data was available, state that the score is based on CV only and may be less reliable\n' +
              'Example: "GitHub profile confirms strong TypeScript skills with 8 active repos, which elevated the score by ~15 points above a CV-only assessment."\n' +
              '\nBe fair, evidence-based, and consider both CV content and real-world signals from GitHub/LinkedIn.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }, { timeout: 30000 })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')
      this.logger.debug(
        `OpenAI response: ${content.length} chars, usage: ${JSON.stringify(response.usage)}`
      )

      const result = JSON.parse(content) as MatchResult & { scoringCriteria?: string[]; limitations?: string[] }
      this.logger.log(
        `Score result: ${result.overallScore}/100, recommendation=${result.recommendation}`
      )

      // Build scoringBasis from server-known data sources + AI-returned criteria
      const dataSources: string[] = ['CV text']
      if (candidate.parsedCV) dataSources.push('AI-parsed CV structure (skills, experience, education)')
      if (candidate.enrichment?.github) {
        const gh = candidate.enrichment.github
        const repoCount = gh.repositories.length
        const langs = gh.topLanguages.length > 0 ? gh.topLanguages.join(', ') : 'no languages detected'
        const starsInfo = gh.totalStars > 0 ? `, ${gh.totalStars} total stars` : ''
        const contribInfo = gh.totalContributions ? `, ~${gh.totalContributions} contributions` : ''
        dataSources.push(`GitHub profile (@${gh.username}) — ${repoCount} active repos, languages: ${langs}${starsInfo}${contribInfo}`)
      }
      if (candidate.enrichment?.linkedin) {
        const li = candidate.enrichment.linkedin
        const skillCount = li.skills.length
        const expCount = li.experience.length
        dataSources.push(`LinkedIn profile — ${expCount} experience entries, ${skillCount} endorsed skills, headline: "${li.headline || 'N/A'}"`)
      }
      if (job.screeningCriteria) dataSources.push('Custom screening criteria from recruiter')

      const aiLimitations = result.limitations || []
      if (!candidate.enrichment?.github && !candidate.enrichment?.linkedin) {
        aiLimitations.push('No external profiles (GitHub/LinkedIn) available — score based on CV only')
      }

      // Nuanced confidence calculation
      let confidence: ScoringBasis['confidence'] = 'low'
      const hasGitHub = !!candidate.enrichment?.github
      const hasLinkedIn = !!candidate.enrichment?.linkedin
      const gitHubHasRepos = hasGitHub && candidate.enrichment!.github!.repositories.length > 0
      const gitHubIsSubstantial = gitHubHasRepos && candidate.enrichment!.github!.repositories.length >= 3

      if (gitHubIsSubstantial && hasLinkedIn) {
        confidence = 'high'
      } else if (gitHubHasRepos || hasLinkedIn) {
        confidence = 'medium'
      } else {
        // No enrichment, or GitHub with 0 repos and no LinkedIn
        confidence = 'low'
        if (hasGitHub && !gitHubHasRepos) {
          aiLimitations.push('GitHub profile exists but has no public repositories — treated as minimal signal')
        }
      }

      const scoringBasis: ScoringBasis = {
        dataSources,
        scoringCriteria: result.scoringCriteria || [],
        confidence,
        limitations: aiLimitations,
      }

      return {
        overallScore: Math.min(100, Math.max(0, result.overallScore)),
        explanation: result.explanation,
        strengths: result.strengths || [],
        gaps: result.gaps || [],
        recommendation: result.recommendation || this.getRecommendation(result.overallScore),
        improvementTips: result.improvementTips || [],
        skillScores: result.skillScores || [],
        scoringBasis,
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('timeout') || err.message.includes('timed out') || err.name === 'APIConnectionTimeoutError')) {
        this.logger.error('OpenAI scoring call timed out after 30s')
      }
      this.logger.error('Matching failed', err)
      return {
        overallScore: 0,
        explanation: 'Matching analysis could not be completed.',
        strengths: [],
        gaps: ['Analysis failed'],
        recommendation: 'weak_match',
      }
    }
  }

  async generateInterviewQuestions(
    candidate: { cvText: string; matchResult: MatchResult; enrichment?: EnrichedProfile | null },
    job: { description: string; requirements: string[] }
  ): Promise<InterviewQuestionsResult> {
    this.logger.log('Generating interview questions')

    let prompt = `## Job Description\n${job.description}\n\n`
    prompt += `## Requirements\n${job.requirements.map((r) => `- ${r}`).join('\n')}\n\n`
    prompt += `## Candidate CV (excerpt)\n${candidate.cvText.slice(0, 3000)}\n\n`
    prompt += `## Match Analysis\n`
    prompt += `Score: ${candidate.matchResult.overallScore}/100\n`
    prompt += `Strengths: ${candidate.matchResult.strengths.join(', ')}\n`
    prompt += `Gaps: ${candidate.matchResult.gaps.join(', ')}\n`
    prompt += `Recommendation: ${candidate.matchResult.recommendation}\n\n`

    // Include GitHub project details for targeted questions
    if (candidate.enrichment?.github) {
      const gh = candidate.enrichment.github
      prompt += `## GitHub Profile (@${gh.username})\n`
      prompt += `Bio: ${gh.bio || 'N/A'}\n`
      prompt += `Top Languages: ${gh.topLanguages.join(', ') || 'N/A'}\n`
      prompt += `Total Stars: ${gh.totalStars}\n`
      if (gh.repositories.length > 0) {
        prompt += `Notable Repositories:\n`
        gh.repositories.forEach((r) => {
          prompt += `- **${r.name}** (${r.language || 'N/A'}, ${r.stars} stars): ${r.description || 'No description'}\n`
        })
      }
      prompt += '\n'
    }

    if (candidate.enrichment?.linkedin) {
      const li = candidate.enrichment.linkedin
      prompt += `## LinkedIn Profile\n`
      prompt += `Headline: ${li.headline || 'N/A'}\n`
      if (li.experience.length > 0) {
        prompt += `Experience: ${li.experience.join('; ')}\n`
      }
      prompt += '\n'
    }

    prompt += 'Generate 6-8 personalized interview questions for this candidate. Return JSON.'

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a recruitment AI that generates personalized interview questions. ' +
              'Based on the candidate CV, match analysis (strengths and gaps), job requirements, ' +
              'and any available GitHub/LinkedIn enrichment data, ' +
              'generate 6-8 targeted interview questions. Return a JSON object with a "questions" array. ' +
              'Each question object must have: ' +
              '"question" (the interview question string), ' +
              '"category" (one of: "technical", "behavioral", "experience", "gap-exploration"), ' +
              '"rationale" (a brief explanation of why this question is relevant for this specific candidate). ' +
              'Questions should probe the candidate\'s specific gaps and validate their claimed strengths. ' +
              'Include a mix of categories. ' +
              'IMPORTANT: If GitHub project data is provided, include at least 1-2 questions that reference SPECIFIC GitHub repositories the candidate has built. ' +
              'Ask about architecture decisions, technical challenges, or design choices in those projects. ' +
              'For example: "Your repo X uses Y framework — what led you to choose that over alternatives?" or ' +
              '"Tell me about the most challenging technical problem you solved while building [repo name]."',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      }, { timeout: 30000 })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')

      const result = JSON.parse(content) as InterviewQuestionsResult
      this.logger.log(`Generated ${result.questions?.length ?? 0} interview questions`)
      return { questions: result.questions || [] }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('timeout') || err.message.includes('timed out') || err.name === 'APIConnectionTimeoutError')) {
        this.logger.error('OpenAI interview questions call timed out after 30s')
      }
      this.logger.error('Interview question generation failed', err)
      throw err
    }
  }

  private buildPrompt(candidate: CandidateData, job: JobData): string {
    let prompt = `## Job Description\n${job.description}\n\n`
    prompt += `## Requirements\n${job.requirements.map((r) => `- ${r}`).join('\n')}\n\n`

    if (job.screeningCriteria) {
      prompt += `## SCREENING CRITERIA (HIGHEST PRIORITY — recruiter's mandatory scoring rules)\nThese criteria MUST be applied as score overrides. Follow them exactly:\n${job.screeningCriteria}\n\n`
    }

    // Prefer structured parsed CV data over raw text
    if (candidate.parsedCV) {
      const cv = candidate.parsedCV as Record<string, unknown>
      prompt += `## Candidate Profile (AI-parsed from CV)\n`
      if (cv.summary) prompt += `Summary: ${cv.summary}\n\n`
      if (Array.isArray(cv.skills) && cv.skills.length > 0) {
        prompt += `Skills: ${cv.skills.join(', ')}\n\n`
      }
      if (Array.isArray(cv.experience) && cv.experience.length > 0) {
        prompt += `Work Experience:\n`
        for (const exp of cv.experience as {
          title: string
          company: string
          duration: string
          description: string
        }[]) {
          prompt += `- **${exp.title}** at ${exp.company} (${exp.duration}): ${exp.description}\n`
        }
        prompt += '\n'
      }
      if (Array.isArray(cv.education) && cv.education.length > 0) {
        prompt += `Education:\n`
        for (const edu of cv.education as { degree: string; school: string; year: string }[]) {
          prompt += `- ${edu.degree} — ${edu.school} (${edu.year})\n`
        }
        prompt += '\n'
      }
    } else {
      prompt += `## Candidate CV Content (raw text)\n${candidate.cvText.slice(0, 4000)}\n\n`
    }

    if (candidate.enrichment?.github) {
      const gh = candidate.enrichment.github
      prompt += `## GitHub Profile (@${gh.username})\n`
      prompt += `Bio: ${gh.bio || 'N/A'}\n`
      prompt += `Top Languages: ${gh.topLanguages.join(', ') || 'N/A'}\n`
      prompt += `Total Stars: ${gh.totalStars}\n`
      if (gh.repositories.length > 0) {
        prompt += `Notable Repos:\n`
        gh.repositories.forEach((r) => {
          prompt += `- ${r.name} (${r.language || 'N/A'}, ${r.stars} stars): ${r.description || 'No description'}\n`
        })
      }
      prompt += '\n'
    }

    if (candidate.enrichment?.linkedin) {
      const li = candidate.enrichment.linkedin
      prompt += `## LinkedIn Profile\n`
      prompt += `Headline: ${li.headline || 'N/A'}\n`
      prompt += `Summary: ${li.summary || 'N/A'}\n`
      if (li.experience.length > 0) {
        prompt += `Experience: ${li.experience.join('; ')}\n`
      }
      if (li.skills.length > 0) {
        prompt += `Skills: ${li.skills.join(', ')}\n`
      }
      prompt += '\n'
    }

    prompt += 'Evaluate this candidate against the job requirements. Return JSON.'
    return prompt
  }

  private getRecommendation(score: number): MatchResult['recommendation'] {
    if (score >= 80) return 'strong_match'
    if (score >= 60) return 'good_match'
    if (score >= 40) return 'partial_match'
    return 'weak_match'
  }
}
