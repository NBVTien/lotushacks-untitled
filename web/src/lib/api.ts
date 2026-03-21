import axios from 'axios'
import type { Job, CreateJobDto, Candidate, RegisterDto, LoginDto, AuthResponse, PaginatedResponse } from '@lotushack/shared'

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
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const authApi = {
  register: (dto: RegisterDto) => api.post<AuthResponse>('/auth/register', dto).then((r) => r.data),
  login: (dto: LoginDto) => api.post<AuthResponse>('/auth/login', dto).then((r) => r.data),
}

export const jobsApi = {
  list: () => api.get<Job[]>('/jobs').then((r) => r.data),
  listPublic: (page = 1, limit = 10) =>
    api.get<PaginatedResponse<Job>>(`/jobs/public?page=${page}&limit=${limit}`).then((r) => r.data),
  get: (id: string) => api.get<Job & { candidates: Candidate[] }>(`/jobs/${id}`).then((r) => r.data),
  create: (dto: CreateJobDto) => api.post<Job>('/jobs', dto).then((r) => r.data),
  update: (id: string, dto: Partial<CreateJobDto>) =>
    api.patch<Job>(`/jobs/${id}`, dto).then((r) => r.data),
  toggleActive: (id: string, isActive: boolean) =>
    api.patch<Job>(`/jobs/${id}/toggle`, { isActive }).then((r) => r.data),
  delete: (id: string) => api.delete(`/jobs/${id}`),
}

export const discoveryApi = {
  discoverJobs: (data: { skills: string[]; experience: string[]; location: string | null; title: string | null }) =>
    api.post('/discovery/jobs', data).then(r => r.data),
  discoverFromCv: (candidateId: string) =>
    api.post('/discovery/jobs-from-cv', { candidateId }).then(r => r.data),
  researchCompany: (data: { companyName: string; companyUrl?: string }) =>
    api.post('/discovery/company-research', data).then(r => r.data),
  sourceCandidates: (data: { jobTitle: string; skills: string[]; location: string | null; experience: string | null }) =>
    api.post('/discovery/source-candidates', data).then(r => r.data),
  sourceFromJob: (jobId: string) =>
    api.post('/discovery/source-from-job', { jobId }).then(r => r.data),
  streamUrl: (type: string, id: string) =>
    `http://localhost:4005/discovery/${type}/stream?id=${id}`,
}

export const candidatesApi = {
  list: (jobId: string) => api.get<Candidate[]>(`/jobs/${jobId}/candidates`).then((r) => r.data),
  get: (jobId: string, id: string) =>
    api.get<Candidate>(`/jobs/${jobId}/candidates/${id}`).then((r) => r.data),
  upload: (jobId: string, file: File, name?: string, email?: string) => {
    const form = new FormData()
    form.append('cv', file)
    if (name) form.append('name', name)
    if (email) form.append('email', email)
    return api.post<Candidate>(`/jobs/${jobId}/candidates/upload`, form).then((r) => r.data)
  },
  retry: (jobId: string, id: string) =>
    api.post<Candidate>(`/jobs/${jobId}/candidates/${id}/retry`).then((r) => r.data),
  reEnrich: (jobId: string, id: string) =>
    api.post<Candidate>(`/jobs/${jobId}/candidates/${id}/re-enrich`).then((r) => r.data),
  extendedEnrich: (jobId: string, id: string, types: string[]) =>
    api.post<Candidate>(`/jobs/${jobId}/candidates/${id}/extended-enrich`, { types }).then((r) => r.data),
  getCvUrl: (jobId: string, id: string) =>
    api.get<{ url: string }>(`/jobs/${jobId}/candidates/${id}/cv-url`).then((r) => r.data),
  delete: (jobId: string, id: string) => api.delete(`/jobs/${jobId}/candidates/${id}`),
  enrichmentStreamUrl: (jobId: string, id: string) =>
    `http://localhost:4005/jobs/${jobId}/candidates/${id}/enrichment-stream`,
}
