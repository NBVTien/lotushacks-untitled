import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { discoveryApi } from '@/lib/api'

interface CompanyData {
  name: string
  glassdoorRating?: number
  reviewsSummary?: string
  techBlog?: string
  recentNews?: string[]
  culture?: string
  benefits?: string[]
  techStack?: string[]
  industry?: string
  size?: string
  website?: string
  summary?: string
}

export function CompanyResearchPage() {
  const { name } = useParams<{ name: string }>()
  const companyName = decodeURIComponent(name || '')
  const [loading, setLoading] = useState(false)
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const fetchResearch = async () => {
    if (!companyName) return
    setLoading(true)
    setError(null)
    setLogs([])
    setCompany(null)
    setFetched(true)

    try {
      const result = await discoveryApi.researchCompany({ companyName })

      if (result.streamId) {
        const url = discoveryApi.streamUrl('company-research', result.streamId)
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.log) {
              setLogs(prev => [...prev, data.log])
            }
            if (data.company) {
              setCompany(data.company)
            }
            if (data.done) {
              es.close()
              eventSourceRef.current = null
              setLoading(false)
              if (data.company) setCompany(data.company)
            }
          } catch { /* ignore */ }
        }

        es.onerror = () => {
          es.close()
          eventSourceRef.current = null
          setLoading(false)
        }
      } else {
        if (result.company) setCompany(result.company)
        else setCompany(result)
        setLoading(false)
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to research company')
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => {
    if (companyName && !fetched) {
      fetchResearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName])

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link to="/careers" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Careers
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{companyName}</h1>
          <p className="mt-1 text-muted-foreground">Company Research</p>
        </div>
        <Button onClick={fetchResearch} disabled={loading} variant="outline">
          {loading ? 'Researching...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Log viewer */}
      {(loading || logs.length > 0) && (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/40">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-muted-foreground font-mono">Research Progress</span>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${loading ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              <span className="text-sm text-muted-foreground">{loading ? 'Streaming...' : 'Complete'}</span>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto px-4 pb-4 font-mono text-xs">
            {logs.map((log, i) => (
              <p key={i} className="text-muted-foreground leading-relaxed">
                <span className="inline-block w-6 text-right text-muted-foreground/40 mr-3 select-none">{i + 1}</span>
                {log}
              </p>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {loading && logs.length === 0 && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Researching company...</p>
          </div>
        </div>
      )}

      {/* Company Results */}
      {company && (
        <div className="space-y-4">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                {company.size && <Badge variant="outline">{company.size}</Badge>}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer">
                    <Badge variant="outline" className="hover:bg-muted cursor-pointer">{company.website}</Badge>
                  </a>
                )}
              </div>
              {company.summary && <p className="text-sm">{company.summary}</p>}
            </CardContent>
          </Card>

          {/* Glassdoor */}
          {(company.glassdoorRating || company.reviewsSummary) && (
            <Card>
              <CardHeader>
                <CardTitle>Glassdoor Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {company.glassdoorRating && (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold">{company.glassdoorRating}</span>
                    <span className="text-muted-foreground">/ 5.0</span>
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={`text-lg ${i < Math.round(company.glassdoorRating!) ? 'text-yellow-400' : 'text-gray-300'}`}>
                          &#9733;
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {company.reviewsSummary && (
                  <p className="text-sm text-muted-foreground">{company.reviewsSummary}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tech Stack */}
          {company.techStack && company.techStack.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tech Stack</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {company.techStack.map((t, i) => (
                    <Badge key={i} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tech Blog */}
          {company.techBlog && (
            <Card>
              <CardHeader>
                <CardTitle>Tech Blog</CardTitle>
              </CardHeader>
              <CardContent>
                <a href={company.techBlog} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                  {company.techBlog}
                </a>
              </CardContent>
            </Card>
          )}

          {/* Recent News */}
          {company.recentNews && company.recentNews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent News</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {company.recentNews.map((n, i) => (
                    <li key={i} className="text-muted-foreground">{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Culture & Benefits */}
          {(company.culture || (company.benefits && company.benefits.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle>Culture & Benefits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.culture && <p className="text-sm">{company.culture}</p>}
                {company.benefits && company.benefits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {company.benefits.map((b, i) => (
                      <Badge key={i} variant="outline">{b}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && fetched && !company && !error && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No research data available for this company.</p>
        </div>
      )}
    </div>
  )
}
