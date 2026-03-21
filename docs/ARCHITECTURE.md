# Architecture

---

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (React 19)                      │
│                                                               │
│  Recruiter Dashboard          │  Candidate Portal             │
│  ├── Dashboard (stats)        │  ├── CV profile & auth        │
│  ├── Job management           │  ├── Gap analysis (AI)        │
│  ├── CV evaluation pipeline   │  ├── Learning mentor (AI)     │
│  ├── Deep enrichment          │  └── Company research         │
│  └── Company verification     │                               │
└───────────────────────┬───────────────────────────────────────┘
                        │ HTTP (Axios)
┌───────────────────────▼───────────────────────────────────────┐
│                      API (NestJS 11)                           │
│                                                                │
│  ┌──────┐ ┌──────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐│
│  │ Auth │ │ Jobs │ │ Candidates │ │Enrichment │ │ Matching ││
│  └──────┘ └──────┘ └────────────┘ └───────────┘ └──────────┘│
│  ┌──────────────────┐ ┌───────────┐                          │
│  │ CandidatePortal  │ │ Discovery │                          │
│  └──────────────────┘ └───────────┘                          │
│                                                                │
│  ┌──────────────────────────────┐                              │
│  │   BullMQ Worker (async)     │                              │
│  └──────────────────────────────┘                              │
└────────┬──────────────────┬──────────────────┬─────────────────┘
         │                  │                  │
┌────────▼────────┐ ┌──────▼───────┐ ┌────────▼──────────┐
│  PostgreSQL 16  │ │   Redis 7    │ │   MinIO (S3)      │
│  (Data)         │ │  (Queues)    │ │  (CV PDFs)        │
└─────────────────┘ └──────────────┘ └───────────────────┘
         │
┌────────▼───────────────────────────────────────────────┐
│  External APIs                                          │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  OpenAI  │  │   TinyFish   │  │   GitHub API    │  │
│  │GPT-4o-mi │  │  Web Agents  │  │  (REST)         │  │
│  └──────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Modules

| Module | Responsibility |
|--------|---------------|
| `auth/` | JWT auth, recruiter + candidate registration, role-based guards |
| `jobs/` | CRUD for job descriptions, public listing, company-scoped |
| `candidates/` | CV upload (MinIO), PDF parsing (OpenAI), link extraction, BullMQ processing |
| `enrichment/` | GitHub API integration, TinyFish crawl service (SSE) |
| `matching/` | OpenAI GPT-4o-mini scoring engine — used by both recruiter and candidate sides |
| `candidate-portal/` | Candidate CV profile, saved JDs, gap analysis, learning mentor (TinyFish + OpenAI) |
| `discovery/` | Company research — TinyFish-powered |

---

## Data Flow: Recruiter Pipeline

```
Recruiter uploads CV
        │
        ▼
┌─────────────────────────┐
│ 1. Store PDF → MinIO    │  (~200ms, synchronous)
│ 2. Create candidate     │
│ 3. Queue to BullMQ      │
└─────────┬───────────────┘
          │
          ▼  (async worker)
┌─────────────────────────────────────────────┐
│ Step 1: CV Parsing (~5s)                    │
│ └── OpenAI: PDF → skills, exp, links       │
│                                             │
│ Step 2: Enrichment (~30-400s)               │
│ ├── GitHub API: repos, languages, commits   │
│ └── TinyFish: LinkedIn profile (stealth)    │
│                                             │
│ Step 3: AI Scoring (~3-5s)                  │
│ └── OpenAI: CV + enrichment vs JD → score  │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│ On-demand Extended Enrichment (TinyFish)    │
│ ├── Portfolio, blog, live projects, SO      │
│ ├── Company verification                   │
│ └── Each type runs independently via SSE    │
└─────────────────────────────────────────────┘
```

---

## Data Flow: Candidate Gap Analysis

```
Candidate uploads CV → OpenAI parses skills, experience
        │
        ▼
Candidate saves JD (from platform or pasted)
        │
        ▼
┌─────────────────────────────────────────────┐
│ Gap Analysis (MatchingService)              │
│ ├── CV data vs JD requirements             │
│ ├── Overall score, strengths, gaps         │
│ ├── Per-skill scores (yes/partial/no)      │
│ └── Improvement areas with priorities      │
└─────────┬───────────────────────────────────┘
          │
          ▼  (on-demand per skill, SSE streaming)
┌─────────────────────────────────────────────┐
│ Learning Mentor (OpenAI → TinyFish → OpenAI)│
│ ├── Candidate selects which skill to learn │
│ ├── Step 1: OpenAI analyzes gap            │
│ │   └── Generates targeted search keywords │
│ ├── Step 2: TinyFish crawls with keywords  │
│ │   └── dev.to + GitHub → raw resources    │
│ ├── Step 3: OpenAI synthesizes advice      │
│ │   └── Summaries + key takeaways          │
│ └── Results cached per skill per JD        │
│     └── Loadable on refresh via GET API    │
└─────────────────────────────────────────────┘
```

---

## TinyFish Integration

All TinyFish calls use the same service (`TinyFishCrawlService`):

```typescript
// Send URL + goal → get structured result via SSE
const result = await tinyfish.crawl(url, goal, {
  browserProfile: 'stealth' | 'lite',
  onProgress: (msg) => res.write(sseEvent(msg)),
})
```

| Use Case | URL Target | Mode | Returns |
|----------|-----------|------|---------|
| LinkedIn profile | linkedin.com/in/xxx | stealth | Headline, experience, skills |
| Portfolio analysis | Candidate's website | lite | Tech stack, design quality, responsiveness |
| Blog analysis | dev.to / Medium / blog | lite | Post count, topics, writing quality |
| Live project check | Deployed app URL | lite | Online status, tech, UI quality |
| Company verification | Google → company site | lite | Existence, industry, tech stack |
| Candidate sourcing | LinkedIn, Upwork, Toptal | stealth | Candidate profiles with skills |
| Company research | Glassdoor, tech blogs | lite | Reviews, culture, benefits |
| Learning resources | dev.to, GitHub | lite | Raw data → OpenAI mentor synthesis |

---

## Database Schema

```
users
├── id (uuid, PK)
├── email (varchar, unique)
├── password (varchar, bcrypt)
├── name (varchar)
├── role (varchar: 'recruiter' | 'candidate')
├── companyId (uuid, FK → companies, nullable)
├── cvText (text, nullable)           ← candidate CV
├── parsedCV (jsonb, nullable)        ← {skills[], experience[], education[]}
└── createdAt (timestamp)

companies
├── id (uuid, PK)
├── name, description, logo
└── createdAt (timestamp)

jobs
├── id (uuid, PK)
├── companyId (uuid, FK → companies)
├── title, description (markdown), requirements (text[])
├── screeningCriteria (text, nullable)
├── isActive (boolean)
└── createdAt (timestamp)

candidates
├── id (uuid, PK)
├── jobId (uuid, FK → jobs)
├── name, email, phone
├── cvUrl (MinIO path), cvText
├── links (jsonb), parsedCV (jsonb)
├── enrichment (jsonb)               ← GitHub + LinkedIn
├── extendedEnrichment (jsonb)       ← portfolio, blog, SO, company
├── matchResult (jsonb)              ← score, strengths, gaps
├── status, errorMessage, progressLogs, retryCount
├── pipelineStage, notes (jsonb), pipelineHistory (jsonb)
└── createdAt (timestamp)

saved_jds
├── id (uuid, PK)
├── userId (uuid, FK → users)
├── title, description, requirements (text[])
├── source ('platform' | 'pasted')
├── jobId (uuid, FK → jobs, nullable)
├── lastAnalysis (jsonb, nullable)     ← cached gap analysis result
├── lastResources (jsonb, nullable)    ← cached learning resources per skill
└── createdAt (timestamp)
```

---

## API Reference

Base URL: `http://localhost:4005`. Protected endpoints require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Recruiter registration (name, email, password, companyName) |
| `POST` | `/auth/register-candidate` | Candidate registration (name, email, password) |
| `POST` | `/auth/login` | Login for both roles |
| `GET` | `/auth/me` | Get current user (protected) |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs` | Create job (recruiter) |
| `GET` | `/jobs` | List company jobs (recruiter) |
| `GET` | `/jobs/public?page=1&limit=10` | Public job listing (paginated) |
| `GET` | `/jobs/:id` | Job detail |
| `PATCH` | `/jobs/:id` | Update job (recruiter) |
| `DELETE` | `/jobs/:id` | Delete job (recruiter) |

### Candidates (Recruiter)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs/:jobId/candidates/upload` | Upload CV (multipart PDF) |
| `GET` | `/jobs/:jobId/candidates` | List candidates for job |
| `GET` | `/jobs/:jobId/candidates/:id` | Candidate detail |
| `POST` | `/jobs/:jobId/candidates/:id/retry` | Retry failed processing |
| `POST` | `/jobs/:jobId/candidates/:id/re-enrich` | Re-fetch enrichment data |
| `POST` | `/jobs/:jobId/candidates/:id/extended-enrich` | On-demand TinyFish enrichment |
| `GET` | `/jobs/:jobId/candidates/:id/enrichment-stream` | SSE progress stream |

### Candidate Portal (requires candidate JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/candidate-portal/cv` | Upload CV (multipart PDF) |
| `GET` | `/candidate-portal/profile` | Get profile with parsed CV |
| `POST` | `/candidate-portal/saved-jds` | Save a job description |
| `GET` | `/candidate-portal/saved-jds` | List saved JDs |
| `DELETE` | `/candidate-portal/saved-jds/:id` | Delete saved JD |
| `GET` | `/candidate-portal/saved-jds/:id/resources` | Get cached learning resources |
| `POST` | `/candidate-portal/gap-analysis` | Run AI gap analysis |
| `POST` | `/candidate-portal/learning-resources` | Find learning resources — batch (SSE) |
| `POST` | `/candidate-portal/learning-resources/skill` | Find resources per skill (SSE, supports `force`) |

### Discovery (TinyFish)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/discovery/company-research` | Company research (SSE) |

---

## Security

| Layer | Mechanism |
|-------|-----------|
| Auth | JWT (HS256), 7-day expiry, bcrypt, role-based (`recruiter` / `candidate`) |
| Data Isolation | Company-scoped for recruiters, user-scoped for candidates |
| File Access | MinIO presigned URLs (1hr expiry) |
| Secrets | .env file, never committed |

## Resilience

| Scenario | Handling |
|----------|---------|
| Enrichment fails | Skipped, scoring continues with CV-only data |
| TinyFish timeout | SSE stream closes, error logged, partial results kept |
| LinkedIn blocks bot | 3-method fallback: direct → Google → Yandex |
| Server restart | StartupService resets stuck candidates to `error` |
| BullMQ retry | 3 attempts, exponential backoff (5s, 10s, 20s) |
