import axios from 'axios'
import type {
  Job,
  CreateJobDto,
  Candidate,
  InterviewQuestionsResult,
  RegisterDto,
  LoginDto,
  AuthResponse,
  PaginatedResponse,
  PipelineStage,
  SurveyAnswer,
  CandidateRegisterDto,
  CreateSavedJDDto,
} from '@lotushack/shared'

const api = axios.create({
  baseURL: 'http://localhost:4005',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url?.includes('/auth/')) {
      const userStr = localStorage.getItem('user')
      const isRecruiter = userStr ? JSON.parse(userStr).role === 'recruiter' : false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = isRecruiter ? '/recruiter/login' : '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (dto: RegisterDto) => api.post<AuthResponse>('/auth/register', dto).then((r) => r.data),
  login: (dto: LoginDto) => api.post<AuthResponse>('/auth/login', dto).then((r) => r.data),
}

export interface JobStats {
  totalJobs: number
  activeJobs: number
  totalCandidates: number
  avgScore: number
  pipelineBreakdown: {
    uploaded: number
    parsed: number
    enriching: number
    scoring: number
    completed: number
  }
  recommendationBreakdown: {
    strong_match: number
    good_match: number
    partial_match: number
    weak_match: number
  }
}

export const jobsApi = {
  stats: () => api.get<JobStats>('/jobs/stats').then((r) => r.data),
  list: () => api.get<Job[]>('/jobs').then((r) => r.data),
  listPublic: (page = 1, limit = 10) =>
    api.get<PaginatedResponse<Job>>(`/jobs/public?page=${page}&limit=${limit}`).then((r) => r.data),
  get: (id: string) =>
    api.get<Job & { candidates: Candidate[] }>(`/jobs/${id}`).then((r) => r.data),
  create: (dto: CreateJobDto) => api.post<Job>('/jobs', dto).then((r) => r.data),
  update: (id: string, dto: Partial<CreateJobDto>) =>
    api.patch<Job>(`/jobs/${id}`, dto).then((r) => r.data),
  toggleActive: (id: string, isActive: boolean) =>
    api.patch<Job>(`/jobs/${id}/toggle`, { isActive }).then((r) => r.data),
  delete: (id: string) => api.delete(`/jobs/${id}`),
}

export const discoveryApi = {
  discoverJobs: (data: {
    skills: string[]
    experience: string[]
    location: string | null
    title: string | null
  }) => api.post('/discovery/jobs', data).then((r) => r.data),
  discoverFromCv: (candidateId: string) =>
    api.post('/discovery/jobs-from-cv', { candidateId }).then((r) => r.data),
  researchCompany: (data: { companyName: string; companyUrl?: string }) =>
    api.post('/discovery/company-research', data).then((r) => r.data),
  streamUrl: (type: string, id: string) =>
    `http://localhost:4005/discovery/${type}/stream?id=${id}`,
}

export const candidateAuthApi = {
  register: (dto: CandidateRegisterDto) =>
    api.post<AuthResponse>('/auth/register-candidate', dto).then((r) => r.data),
}

export const portalApi = {
  uploadCv: (file: File) => {
    const form = new FormData()
    form.append('cv', file)
    return api.post('/candidate-portal/cv', form).then((r) => r.data)
  },
  getProfile: () => api.get('/candidate-portal/profile').then((r) => r.data),
  savejd: (dto: CreateSavedJDDto) =>
    api.post('/candidate-portal/saved-jds', dto).then((r) => r.data),
  listSavedJds: () => api.get('/candidate-portal/saved-jds').then((r) => r.data),
  deleteSavedJd: (id: string) => api.delete(`/candidate-portal/saved-jds/${id}`),
  analyzeGap: (savedJdId: string) =>
    api.post('/candidate-portal/gap-analysis', { savedJdId }).then((r) => r.data),
  learningResourcesUrl: () => 'http://localhost:4005/candidate-portal/learning-resources',
  getCachedResources: (savedJdId: string) =>
    api.get(`/candidate-portal/saved-jds/${savedJdId}/resources`).then((r) => r.data),
}

export const candidatesApi = {
  list: (jobId: string) => api.get<Candidate[]>(`/jobs/${jobId}/candidates`).then((r) => r.data),
  get: (jobId: string, id: string) =>
    api.get<Candidate>(`/jobs/${jobId}/candidates/${id}`).then((r) => r.data),
  upload: (jobId: string, file: File, name?: string, email?: string, surveyAnswers?: SurveyAnswer[]) => {
    const form = new FormData()
    form.append('cv', file)
    if (name) form.append('name', name)
    if (email) form.append('email', email)
    if (surveyAnswers && surveyAnswers.length > 0) form.append('surveyAnswers', JSON.stringify(surveyAnswers))
    return api.post<Candidate>(`/jobs/${jobId}/candidates/upload`, form).then((r) => r.data)
  },
  retry: (jobId: string, id: string) =>
    api.post<Candidate>(`/jobs/${jobId}/candidates/${id}/retry`).then((r) => r.data),
  reEnrich: (jobId: string, id: string) =>
    api.post<Candidate>(`/jobs/${jobId}/candidates/${id}/re-enrich`).then((r) => r.data),
  extendedEnrich: (
    jobId: string,
    id: string,
    types: string[],
    opts?: { companyName?: string; companyUrl?: string }
  ) =>
    api
      .post<Candidate>(`/jobs/${jobId}/candidates/${id}/extended-enrich`, { types, ...opts })
      .then((r) => r.data),
  getCvUrl: (jobId: string, id: string) =>
    api.get<{ url: string }>(`/jobs/${jobId}/candidates/${id}/cv-url`).then((r) => r.data),
  delete: (jobId: string, id: string) => api.delete(`/jobs/${jobId}/candidates/${id}`),
  generateInterviewQuestions: (jobId: string, candidateId: string) =>
    api
      .post<InterviewQuestionsResult>(`/jobs/${jobId}/candidates/${candidateId}/interview-questions`)
      .then((r) => r.data),
  enrichmentStreamUrl: (jobId: string, id: string) =>
    `http://localhost:4005/jobs/${jobId}/candidates/${id}/enrichment-stream`,
  updatePipelineStage: (jobId: string, candidateId: string, stage: PipelineStage) =>
    api
      .patch<Candidate>(`/jobs/${jobId}/candidates/${candidateId}/pipeline-stage`, { stage })
      .then((r) => r.data),
  addNote: (jobId: string, candidateId: string, text: string) =>
    api
      .post<Candidate>(`/jobs/${jobId}/candidates/${candidateId}/notes`, { text })
      .then((r) => r.data),
  getPipeline: (jobId: string) =>
    api
      .get<Record<PipelineStage, Candidate[]>>(`/jobs/${jobId}/candidates/pipeline`)
      .then((r) => r.data),
}
