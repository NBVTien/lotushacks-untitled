import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type ProgressCallback = (msg: string) => void

export interface CrawlOptions {
  browserProfile?: 'lite' | 'stealth'
  useVault?: boolean
  label?: string
  onProgress?: ProgressCallback
}

@Injectable()
export class TinyFishCrawlService {
  private readonly logger = new Logger(TinyFishCrawlService.name)
  private readonly apiKey: string

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get('TINYFISH_API_KEY', '')
  }

  get isConfigured(): boolean {
    return !!this.apiKey
  }

  async crawl(url: string, goal: string, options?: CrawlOptions): Promise<string | null> {
    if (!this.apiKey) {
      this.logger.warn('TinyFish API key not configured')
      return null
    }

    const label = options?.label || ''
    const prefix = label ? `[${label}]` : ''
    const startTime = Date.now()

    this.logger.log(`SSE crawl: ${url} (profile: ${options?.browserProfile || 'lite'})`)
    options?.onProgress?.(`${prefix} Starting crawl: ${url}`)

    try {
      const body: Record<string, unknown> = { url, goal }
      if (options?.browserProfile) body.browser_profile = options.browserProfile
      if (options?.useVault) body.use_vault = true

      const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        this.logger.error(`TinyFish SSE error: ${response.status} — ${errBody}`)
        options?.onProgress?.(`${prefix} Error: ${response.status}`)
        return null
      }

      if (!response.body) {
        this.logger.error('TinyFish SSE returned no body')
        return null
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lastResult: string | null = null
      let status = 'RUNNING'

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            const data = trimmed.slice(5).trim()
            if (!data || data === '[DONE]') continue

            try {
              const event = JSON.parse(data)
              if (event.type === 'PROGRESS' && event.purpose) {
                this.logger.debug(`SSE progress: ${event.purpose}`)
                options?.onProgress?.(`${prefix} ${event.purpose}`)
              } else if (event.type === 'COMPLETE') {
                status = event.status || 'COMPLETED'
                if (event.result) {
                  lastResult =
                    typeof event.result === 'string' ? event.result : JSON.stringify(event.result)
                }
              } else if (event.type === 'STARTED') {
                this.logger.log(`SSE started: run_id=${event.run_id}`)
                options?.onProgress?.(`${prefix} Agent started (${event.run_id?.slice(0, 8)}...)`)
              }
            } catch {
              if (data.length > 10) lastResult = data
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000)
      this.logger.log(`SSE ended for ${url} in ${elapsed}s, status=${status}`)
      options?.onProgress?.(`${prefix} Completed in ${elapsed}s`)

      if (status === 'FAILED' || status === 'CANCELLED') {
        options?.onProgress?.(`${prefix} Failed: ${status}`)
        return null
      }

      return lastResult
    } catch (err) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      this.logger.error(`SSE crawl error for ${url} after ${elapsed}s:`, err)
      options?.onProgress?.(`${prefix} Connection lost after ${elapsed}s`)
      return null
    }
  }
}
