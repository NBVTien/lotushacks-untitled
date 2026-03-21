import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { ExtractedLinks } from '@lotushack/shared'

export interface ParsedCV {
  name: string
  email: string | null
  phone: string | null
  links: ExtractedLinks
  summary: string | null
  skills: string[]
  experience: { title: string; company: string; duration: string; description: string }[]
  education: { degree: string; school: string; year: string }[]
  rawText: string
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name)
  private readonly openai: OpenAI

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY', ''),
    })
  }

  async parseCV(buffer: Buffer, fileName: string): Promise<ParsedCV> {
    this.logger.log(`Parsing CV with OpenAI: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`)

    const base64 = buffer.toString('base64')
    const dataUri = `data:application/pdf;base64,${base64}`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a CV/resume parser. Extract ALL structured information from the uploaded PDF. ' +
              'Return a JSON object with these fields:\n' +
              '- name (string): full name of the candidate\n' +
              '- email (string|null): email address\n' +
              '- phone (string|null): phone number\n' +
              '- github (string|null): GitHub profile URL\n' +
              '- linkedin (string|null): LinkedIn profile URL\n' +
              '- portfolio (string[]): other website/portfolio URLs\n' +
              '- summary (string|null): professional summary or objective\n' +
              '- skills (string[]): list of ALL technical and soft skills\n' +
              '- experience (array of {title, company, duration, description}): ALL work experience entries\n' +
              '- education (array of {degree, school, year}): ALL education entries\n' +
              '- rawText (string): full plain text extraction of the CV content\n\n' +
              'Be thorough and extract EVERYTHING. If a field is not found, use null or empty array.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: fileName,
                  file_data: dataUri,
                },
              },
              {
                type: 'text',
                text: 'Parse this CV/resume. Extract all information and return JSON.',
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')

      this.logger.log(`OpenAI CV parse response: ${content.length} chars, tokens: ${JSON.stringify(response.usage)}`)
      const parsed = JSON.parse(content)

      const result: ParsedCV = {
        name: parsed.name || 'Unknown',
        email: parsed.email || null,
        phone: parsed.phone || null,
        links: {
          github: parsed.github || null,
          linkedin: parsed.linkedin || null,
          portfolio: parsed.portfolio || [],
        },
        summary: parsed.summary || null,
        skills: parsed.skills || [],
        experience: (parsed.experience || []).map((e: Record<string, string>) => ({
          title: e.title || '',
          company: e.company || '',
          duration: e.duration || '',
          description: e.description || '',
        })),
        education: (parsed.education || []).map((e: Record<string, string>) => ({
          degree: e.degree || '',
          school: e.school || '',
          year: e.year || '',
        })),
        rawText: parsed.rawText || '',
      }

      this.logger.log(
        `CV parsed: name="${result.name}", email=${result.email || 'N/A'}, ` +
        `skills=${result.skills.length}, exp=${result.experience.length}, edu=${result.education.length}, ` +
        `github=${result.links.github || 'none'}, linkedin=${result.links.linkedin || 'none'}`,
      )
      return result
    } catch (err) {
      this.logger.error('OpenAI CV parsing failed', err)
      return {
        name: 'Unknown',
        email: null,
        phone: null,
        links: { github: null, linkedin: null, portfolio: [] },
        summary: null,
        skills: [],
        experience: [],
        education: [],
        rawText: '',
      }
    }
  }
}
