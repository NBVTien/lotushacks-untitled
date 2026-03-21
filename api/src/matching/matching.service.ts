import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { EnrichedProfile, MatchResult } from '@lotushack/shared'

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
    this.logger.log(`Scoring: cvText=${candidate.cvText.length} chars, parsedCV=${!!candidate.parsedCV}, enrichment.github=${!!candidate.enrichment?.github}, enrichment.linkedin=${!!candidate.enrichment?.linkedin}`)
    this.logger.debug(`Job: requirements=${job.requirements.length}, hasScreening=${!!job.screeningCriteria}`)

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
              'recommendation (one of: strong_match, good_match, partial_match, weak_match). ' +
              'Be fair, evidence-based, and consider both CV content and real-world signals from GitHub/LinkedIn.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')
      this.logger.debug(`OpenAI response: ${content.length} chars, usage: ${JSON.stringify(response.usage)}`)

      const result = JSON.parse(content) as MatchResult
      this.logger.log(`Score result: ${result.overallScore}/100, recommendation=${result.recommendation}`)
      return {
        overallScore: Math.min(100, Math.max(0, result.overallScore)),
        explanation: result.explanation,
        strengths: result.strengths || [],
        gaps: result.gaps || [],
        recommendation: result.recommendation || this.getRecommendation(result.overallScore),
      }
    } catch (err) {
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

  private buildPrompt(candidate: CandidateData, job: JobData): string {
    let prompt = `## Job Description\n${job.description}\n\n`
    prompt += `## Requirements\n${job.requirements.map((r) => `- ${r}`).join('\n')}\n\n`

    if (job.screeningCriteria) {
      prompt += `## Screening Criteria (IMPORTANT — recruiter's additional filtering criteria)\n${job.screeningCriteria}\n\n`
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
        for (const exp of cv.experience as { title: string; company: string; duration: string; description: string }[]) {
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
