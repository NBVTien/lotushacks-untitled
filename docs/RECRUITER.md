# Recruiter Guide

The Recruiter Dashboard helps hiring managers manage job postings, evaluate candidates with AI, and proactively source talent.

**URL**: [localhost:5173](http://localhost:5173) (login required)

## Features

### Job Management
- Create job descriptions with Markdown formatting
- Add private **screening criteria** — AI uses these for scoring but candidates never see them
- Toggle jobs active/inactive without deleting
- View all candidates per job with scores and recommendations

### CV Evaluation Pipeline

When a CV is uploaded (by candidate or recruiter):

```
Upload PDF → AI Parse → GitHub Enrich → AI Score → Done
```

1. **AI Parsing** — OpenAI extracts name, email, skills, experience, education, and embedded hyperlinks from the PDF
2. **GitHub Enrichment** (immediate) — Fetches repos, languages, commit activity, and runs per-project AI analysis
3. **AI Scoring** — GPT-4o-mini evaluates candidate vs job requirements, producing a 0-100 score with strengths, gaps, and recommendation

### On-Demand Enrichment (TinyFish)

After initial scoring, recruiters can run additional analysis per URL:

| Type | What it does |
|------|-------------|
| **LinkedIn** | Crawl LinkedIn profile (headline, experience, skills) via stealth browser |
| **Portfolio** | Analyze personal websites (design quality, tech stack, responsiveness) |
| **Blog** | Analyze dev.to, Medium, Hashnode posts (topic focus, writing quality) |
| **Stack Overflow** | Check reputation, badges, top tags |
| **Live Projects** | Visit deployed apps, check if they work, analyze UI quality |
| **Company Intel** | Verify companies from CV experience (existence, tech stack, industry) |

Each type runs as an independent async job with real-time progress streaming (SSE).

### Candidate Sourcing

**Route**: `/jobs/:jobId/source`

Proactively search for candidates across job platforms:
- Enter job title, required skills, location, and experience level
- Or auto-fill from the job posting's requirements
- TinyFish agents crawl **ITviec**, **TopDev**, and **LinkedIn** in parallel
- Returns matching candidate profiles with links, skills, and summaries

## API Endpoints

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs` | Create job |
| `GET` | `/jobs` | List your company's jobs |
| `GET` | `/jobs/:id` | Job detail with candidates |
| `PATCH` | `/jobs/:id` | Update job |
| `PATCH` | `/jobs/:id/toggle` | Toggle active/inactive |
| `DELETE` | `/jobs/:id` | Delete job |

### Candidates

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs/:jobId/candidates/upload` | Upload CV (multipart) |
| `GET` | `/jobs/:jobId/candidates` | List candidates |
| `GET` | `/jobs/:jobId/candidates/:id` | Candidate detail |
| `POST` | `/jobs/:jobId/candidates/:id/retry` | Retry failed processing |
| `POST` | `/jobs/:jobId/candidates/:id/re-enrich` | Re-fetch GitHub data |
| `POST` | `/jobs/:jobId/candidates/:id/extended-enrich` | Run on-demand enrichment |
| `GET` | `/jobs/:jobId/candidates/:id/enrichment-stream` | SSE progress stream |
| `GET` | `/jobs/:jobId/candidates/:id/cv-url` | Get PDF download URL |

### Sourcing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/discovery/source-candidates` | Search by skills/title/location |
| `POST` | `/discovery/source-from-job` | Search from job requirements |
