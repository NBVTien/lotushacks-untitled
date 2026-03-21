import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { ExtractedLinks } from '@lotushack/shared'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs')

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

  /** Extract all hyperlink URLs embedded in PDF annotations */
  private async extractPdfLinks(buffer: Buffer): Promise<string[]> {
    try {
      const data = new Uint8Array(buffer)
      const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
      const urls: string[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const annotations = await page.getAnnotations()
        for (const annot of annotations) {
          if (annot.subtype === 'Link' && annot.url) {
            urls.push(annot.url)
          }
        }
      }

      return [...new Set(urls)]
    } catch (err) {
      this.logger.warn(
        `Failed to extract PDF links: ${err instanceof Error ? err.message : String(err)}`
      )
      return []
    }
  }

  async parseCV(buffer: Buffer, fileName: string): Promise<ParsedCV> {
    this.logger.log(`Parsing CV with OpenAI: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`)

    // Extract embedded hyperlinks from PDF annotations (invisible to vision models)
    const embeddedLinks = await this.extractPdfLinks(buffer)
    this.logger.log(
      `Embedded PDF links found: ${embeddedLinks.length} — ${embeddedLinks.join(', ') || 'none'}`
    )

    const base64 = buffer.toString('base64')
    const dataUri = `data:application/pdf;base64,${base64}`

    const linksHint =
      embeddedLinks.length > 0
        ? `\n\nIMPORTANT: The following hyperlinks were embedded in the PDF but may not be visible as text. ` +
          `Use these to fill in the github, linkedin, and portfolio fields:\n${embeddedLinks.map((u) => `- ${u}`).join('\n')}`
        : ''

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
              '- experience (array of {title, company, duration, description}): ALL work experience entries. ' +
              'For the description field, include ALL bullet points and details. ' +
              'If a company name or project has a hyperlink, include the URL in the description.\n' +
              '- education (array of {degree, school, year}): ALL education entries\n' +
              '- rawText (string): full plain text extraction of the CV content\n\n' +
              'Be thorough and extract EVERYTHING. If a field is not found, use null or empty array.' +
              linksHint,
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

      this.logger.log(
        `OpenAI CV parse response: ${content.length} chars, tokens: ${JSON.stringify(response.usage)}`
      )
      const parsed = JSON.parse(content)

      // Post-process: fill in links from embedded PDF URLs if OpenAI missed them
      let github: string | null = parsed.github || null
      let linkedin: string | null = parsed.linkedin || null
      const portfolio: string[] = parsed.portfolio || []

      for (const url of embeddedLinks) {
        if (!github && /github\.com\/[^/]+$/i.test(url)) {
          github = url
        } else if (!linkedin && /linkedin\.com/i.test(url)) {
          linkedin = url
        } else if (
          !portfolio.includes(url) &&
          !/mailto:/i.test(url) &&
          !/github\.com/i.test(url) &&
          !/linkedin\.com/i.test(url)
        ) {
          portfolio.push(url)
        }
      }

      // Also collect GitHub project URLs (not the profile, but repo URLs)
      const githubProjectUrls = embeddedLinks.filter(
        (u) => /github\.com\/[^/]+\/[^/]+/i.test(u) && u !== github
      )

      // Classify portfolio URLs using AI
      const classified = await this.classifyUrls(
        portfolio,
        githubProjectUrls,
        parsed.experience || []
      )

      const result: ParsedCV = {
        name: parsed.name || 'Unknown',
        email: parsed.email || null,
        phone: parsed.phone || null,
        links: { github, linkedin, portfolio, classified },
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
          `github=${result.links.github || 'none'}, linkedin=${result.links.linkedin || 'none'}, ` +
          `classified=${classified.length} URLs`
      )
      return result
    } catch (err) {
      this.logger.error('OpenAI CV parsing failed', err)
      return {
        name: 'Unknown',
        email: null,
        phone: null,
        links: { github: null, linkedin: null, portfolio: [], classified: [] },
        summary: null,
        skills: [],
        experience: [],
        education: [],
        rawText: '',
      }
    }
  }

  /** Classify URLs by kind using AI context from the CV */
  private async classifyUrls(
    portfolioUrls: string[],
    githubProjectUrls: string[],
    experience: Record<string, string>[]
  ): Promise<import('@lotushack/shared').ClassifiedUrl[]> {
    const allUrls = [
      ...portfolioUrls,
      ...githubProjectUrls.filter((u) => !portfolioUrls.includes(u)),
    ]
    if (allUrls.length === 0) return []

    const companies = experience.map((e) => e.company).filter(Boolean)

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Classify each URL into one of these kinds:\n' +
              '- "company": employer/company website (e.g. the candidate worked here)\n' +
              '- "project": a project/product the candidate built or contributed to\n' +
              '- "portfolio": the candidate\'s personal website or portfolio\n' +
              '- "blog": blog or article platform\n' +
              '- "other": social media, video, or unrelated\n\n' +
              'Return a JSON array of {url, kind, label} where label is a short human-readable name.',
          },
          {
            role: 'user',
            content:
              `Companies from CV: ${companies.join(', ') || 'none'}\n\n` +
              `URLs to classify:\n${allUrls.map((u) => `- ${u}`).join('\n')}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return allUrls.map((u) => ({ url: u, kind: 'other' as const, label: u }))

      const parsed = JSON.parse(content)
      const items = Array.isArray(parsed) ? parsed : parsed.urls || parsed.classified || []
      return items.map((item: Record<string, string>) => ({
        url: item.url || '',
        kind: (['portfolio', 'blog', 'project', 'company', 'other'].includes(item.kind)
          ? item.kind
          : 'other') as 'portfolio' | 'blog' | 'project' | 'company' | 'other',
        label: item.label || item.url || '',
      }))
    } catch (err) {
      this.logger.warn(
        `URL classification failed: ${err instanceof Error ? err.message : String(err)}`
      )
      return allUrls.map((u) => ({ url: u, kind: 'other' as const, label: new URL(u).hostname }))
    }
  }
}
