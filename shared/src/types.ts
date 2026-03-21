export interface ApiResponse<T> {
  data: T
  message: string
}

// Auth
export interface RegisterDto {
  email: string
  password: string
  name: string
  companyName: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}

// Company
export interface Company {
  id: string
  name: string
  description: string | null
  logo: string | null
  createdAt: string
}

// User
export interface User {
  id: string
  email: string
  name: string
  companyId: string
  company?: Company
  createdAt: string
}

// Job
export interface Job {
  id: string
  companyId: string
  company?: Company
  title: string
  description: string
  requirements: string[]
  screeningCriteria: string | null
  isActive: boolean
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  hasMore: boolean
}

export interface CreateJobDto {
  title: string
  description: string
  requirements: string[]
  screeningCriteria?: string
}

// Candidate
export interface Candidate {
  id: string
  jobId: string
  name: string
  email: string | null
  phone: string | null
  cvUrl: string
  cvText: string
  links: ExtractedLinks
  parsedCV: ParsedCVData | null
  enrichment: EnrichedProfile | null
  extendedEnrichment: ExtendedEnrichment | null
  enrichmentProgress: EnrichmentProgress
  matchResult: MatchResult | null
  status: CandidateStatus
  errorMessage: string | null
  progressLogs: string[]
  retryCount: number
  createdAt: string
}

export interface ParsedCVData {
  summary: string | null
  skills: string[]
  experience: { title: string; company: string; duration: string; description: string }[]
  education: { degree: string; school: string; year: string }[]
}

export type CandidateStatus =
  | 'uploaded'
  | 'parsed'
  | 'enriching'
  | 'enriched'
  | 'scoring'
  | 'completed'
  | 'error'

export interface ClassifiedUrl {
  url: string
  kind: 'portfolio' | 'blog' | 'project' | 'company' | 'other'
  label: string
}

export interface ExtractedLinks {
  github: string | null
  linkedin: string | null
  portfolio: string[]
  classified: ClassifiedUrl[]
}

export interface EnrichedProfile {
  github: GitHubProfile | null
  linkedin: LinkedInProfile | null
}

export interface GitHubProfile {
  username: string
  bio: string | null
  topLanguages: string[]
  repositories: RepoSummary[]
  totalStars: number
  totalContributions: number | null
  raw: string
}

export interface RepoSummary {
  name: string
  description: string | null
  language: string | null
  stars: number
}

export interface LinkedInProfile {
  headline: string | null
  summary: string | null
  experience: string[]
  skills: string[]
  raw: string
}

// Extended Enrichment (on-demand, via TinyFish)
export interface ExtendedEnrichment {
  portfolio: PortfolioAnalysis | null
  liveProjects: LiveProjectCheck[]
  blog: BlogAnalysis | null
  stackoverflow: StackOverflowProfile | null
  companyIntel?: CompanyIntel[]
}

export interface CompanyIntel {
  company: string
  url: string | null
  exists: boolean
  industry: string | null
  techStack: string[]
  size: string | null
  summary: string
}

export type ExtendedEnrichmentType = 'linkedin' | 'portfolio' | 'liveProjects' | 'blog' | 'stackoverflow' | 'companyIntel'

// Per-type enrichment progress tracking
export interface EnrichmentJobStatus {
  status: 'queued' | 'running' | 'completed' | 'error'
  logs: string[]
  error?: string
}

export type EnrichmentProgress = Record<string, EnrichmentJobStatus>

export interface PortfolioAnalysis {
  url: string
  isOnline: boolean
  techStack: string[]
  designQuality: string
  hasResponsive: boolean
  summary: string
}

export interface LiveProjectCheck {
  url: string
  name: string
  isOnline: boolean
  techDetected: string[]
  uiQuality: string
  features: string[]
  summary: string
}

export interface BlogAnalysis {
  platform: string
  url: string
  totalPosts: number
  recentPosts: { title: string; date: string; tags: string[] }[]
  topicFocus: string[]
  writingQuality: string
  summary: string
}

export interface StackOverflowProfile {
  url: string
  reputation: number
  badges: { gold: number; silver: number; bronze: number }
  topTags: { name: string; score: number }[]
  answerCount: number
  summary: string
}

export interface MatchResult {
  overallScore: number
  explanation: string
  strengths: string[]
  gaps: string[]
  recommendation: 'strong_match' | 'good_match' | 'partial_match' | 'weak_match'
}

// Job Discovery (for candidates)
export interface JobDiscoveryRequest {
  skills: string[]
  experience: string[]
  location: string | null
  title: string | null
}

export interface DiscoveredJob {
  title: string
  company: string
  location: string | null
  url: string
  source: string  // e.g. "ITviec", "TopDev", "LinkedIn"
  salary: string | null
  requirements: string[]
  matchReason: string
  postedDate: string | null
}

export interface JobDiscoveryResult {
  query: string
  jobs: DiscoveredJob[]
  sources: string[]
  searchedAt: string
}

// Company Research (for candidates)
export interface CompanyResearch {
  name: string
  website: string | null
  glassdoorUrl: string | null
  rating: number | null
  reviews: { pros: string; cons: string }[]
  techBlog: string | null
  recentNews: string[]
  culture: string | null
  benefits: string[]
  summary: string
}

// Candidate Sourcing (for recruiters)
export interface SourcingRequest {
  jobTitle: string
  skills: string[]
  location: string | null
  experience: string | null
}

export interface SourcedCandidate {
  name: string
  title: string | null
  profileUrl: string
  source: string
  skills: string[]
  experience: string | null
  summary: string
}

export interface SourcingResult {
  query: string
  candidates: SourcedCandidate[]
  sources: string[]
  searchedAt: string
}
