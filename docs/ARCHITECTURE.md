# Architecture

Technical architecture of AI Recruitment Copilot.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Login/   │ │  Jobs    │ │Candidate │ │ Careers Portal   │  │
│  │ Register  │ │Dashboard │ │  Detail  │ │  (Public)        │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (Axios)
┌──────────────────────────────▼──────────────────────────────────┐
│                      API (NestJS)                               │
│  ┌──────┐ ┌──────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐ │
│  │ Auth │ │ Jobs │ │ Candidates │ │Enrichment │ │ Matching │ │
│  └──────┘ └──────┘ └─────┬──────┘ └───────────┘ └──────────┘ │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   BullMQ    │                              │
│                    │   Worker    │                              │
│                    └──────┬──────┘                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────────┐
        │                   │                       │
┌───────▼───────┐  ┌───────▼───────┐  ┌────────────▼──────────┐
│  PostgreSQL   │  │    Redis      │  │     MinIO (S3)        │
│  (Data)       │  │  (Queue)      │  │  (CV PDFs)            │
└───────────────┘  └───────────────┘  └───────────────────────┘
        │
        │  External APIs
        │
┌───────▼───────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  OpenAI  │  │   TinyFish   │  │    GitHub API         │  │
│  │GPT-4o-mi │  │ (SSE crawl)  │  │  (REST, no auth)      │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Candidate Processing

```
Candidate uploads CV
        │
        ▼
┌─────────────────────┐
│ API: Upload Endpoint │ (~200ms)
│ 1. Store PDF → MinIO │
│ 2. Create candidate  │
│    (status: uploaded) │
│ 3. Queue to BullMQ   │
│ 4. Return response   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│ BullMQ Worker                                    │
│                                                  │
│ Step 1: CV Parsing (~5s)                        │
│ ├── Download PDF from MinIO                     │
│ ├── Send PDF (base64) to OpenAI                 │
│ ├── Get structured data: skills, exp, links     │
│ └── Save to DB (status: parsed)                 │
│                                                  │
│ Step 2: Enrichment (~30-400s)                   │
│ ├── GitHub API: profile, repos, README, commits │
│ │   └── OpenAI: analyze top 3 repos             │
│ ├── TinyFish SSE: LinkedIn public profile       │
│ │   └── Fallback: Google → Yandex Translate     │
│ ├── [on fail] Skip, log warning                 │
│ └── Save to DB (status: enriched)               │
│                                                  │
│ Step 3: AI Scoring (~3-5s)                      │
│ ├── Build prompt: JD + requirements + screening │
│ │   + CV data + GitHub + LinkedIn               │
│ ├── OpenAI → score, explanation, strengths, gaps│
│ └── Save to DB (status: completed)              │
└─────────────────────────────────────────────────┘
```

---

## Database Schema

```
companies
├── id (uuid, PK)
├── name (varchar)
├── description (text, nullable)
├── logo (varchar, nullable)
└── createdAt (timestamp)

users
├── id (uuid, PK)
├── email (varchar, unique)
├── password (varchar, bcrypt hashed)
├── name (varchar)
├── companyId (uuid, FK → companies)
└── createdAt (timestamp)

jobs
├── id (uuid, PK)
├── companyId (uuid, FK → companies)
├── title (varchar)
├── description (text, markdown)
├── requirements (text[], array)
├── screeningCriteria (text, nullable)
├── isActive (boolean, default true)
└── createdAt (timestamp)

candidates
├── id (uuid, PK)
├── jobId (uuid, FK → jobs)
├── name (varchar)
├── email (varchar, nullable)
├── phone (varchar, nullable)
├── cvUrl (varchar, MinIO path)
├── cvText (text, raw extraction)
├── links (jsonb: {github, linkedin, portfolio[]})
├── parsedCV (jsonb: {summary, skills[], experience[], education[]})
├── enrichment (jsonb: {github: GitHubProfile, linkedin: LinkedInProfile})
├── extendedEnrichment (jsonb: {portfolio, liveProjects[], blog, stackoverflow, verification[]})
├── matchResult (jsonb: {overallScore, explanation, strengths[], gaps[], recommendation})
├── status (varchar: uploaded|parsed|enriching|enriched|scoring|completed|error)
├── errorMessage (text, nullable)
├── progressLogs (jsonb: string[])
├── retryCount (int, default 0)
└── createdAt (timestamp)
```

---

## External API Usage

### OpenAI GPT-4o-mini
| Use Case | Input | Output |
|----------|-------|--------|
| CV Parsing | PDF file (base64) | Structured candidate data (JSON) |
| GitHub Analysis | Repo README + languages + commits | Developer skill assessment (text) |
| Match Scoring | CV + enrichment + job requirements | Score, explanation, strengths, gaps (JSON) |

### TinyFish Web Agent (SSE)
| Use Case | URL | Mode |
|----------|-----|------|
| LinkedIn profile | linkedin.com/in/xxx?trk=... | stealth |
| Portfolio analysis | candidate's portfolio URL | lite |
| Live project check | deployed app URL | lite |
| Blog analysis | dev.to / Medium / blog URL | lite |
| Stack Overflow | stackoverflow.com/users/xxx | lite |
| Work verification | Google search → company website | lite |

### GitHub REST API (no auth)
| Endpoint | Purpose |
|----------|---------|
| `GET /users/{username}` | Profile, bio, followers |
| `GET /users/{username}/repos?sort=updated` | Repository list |
| `GET /repos/{owner}/{repo}/languages` | Language breakdown |
| `GET /repos/{owner}/{repo}/readme` | README content |
| `GET /repos/{owner}/{repo}/commits?since=...` | Recent commit count |

---

## Security

| Layer | Mechanism |
|-------|-----------|
| Auth | JWT (HS256), 7-day expiry, bcrypt password hashing |
| API Protection | Passport JWT guard on recruiter endpoints |
| Data Isolation | Company-scoped queries (companyId filter) |
| File Access | MinIO presigned URLs (1hr expiry) |
| Secrets | .env file, never committed (.gitignore) |
| Screening Criteria | Stored in DB, never exposed to public API |
| CORS | Enabled on API for frontend origin |

---

## Resilience

| Scenario | Handling |
|----------|---------|
| Enrichment fails | Skipped, scoring continues with CV-only data |
| OpenAI API down | Candidate set to `error`, manual retry available |
| TinyFish timeout | SSE stream naturally closes, error logged |
| Server restart mid-processing | StartupService resets stuck candidates to `error` |
| LinkedIn blocks bot | 3-method fallback: direct → Google → Yandex |
| GitHub API rate limit | Logged as warning, returns null |
| Redis down | BullMQ connection retry with backoff |
| MinIO down | Upload fails with clear error |
