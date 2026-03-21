# Candidate Guide

The Candidate Portal helps job seekers browse opportunities, discover matching jobs with AI, and research companies before applying.

**URL**: [localhost:5173/careers](http://localhost:5173/careers) (no login required)

## Features

### Browse & Apply

- Browse active job listings with infinite scroll
- View full job descriptions with requirements
- Apply by uploading your CV (PDF) with name and email
- Your CV is AI-parsed and scored against the job — the recruiter sees the results

### Job Discovery (AI-powered)

**Route**: `/careers/discover`

Let AI find matching jobs for you across multiple platforms:

1. Enter your **skills** (comma-separated), **desired job title**, and **location**
2. Click **Search Jobs**
3. TinyFish browser agents crawl 3 job boards in parallel:
   - **ITviec** — Vietnam's top IT job board
   - **TopDev** — Developer-focused job platform
   - **LinkedIn Jobs** — Global professional network
4. Results show matching positions with:
   - Job title and company (clickable link to original posting)
   - Source platform badge
   - Salary range (when available)
   - Requirements
   - AI-generated match reason explaining why this job fits your skills

Real-time progress is streamed so you can watch the search happening.

### Company Research

**Route**: `/careers/company/:name`

Before applying, research the company:

- Click **"Research Company"** on any job card in the careers page
- TinyFish agents crawl multiple sources in parallel:
  - **Glassdoor** — ratings and employee reviews (pros/cons)
  - **Tech blog** — engineering blog and technical culture
  - **Company website** — overview, industry, and size
- Results include:
  - Overall rating (if available)
  - Review highlights
  - Tech stack and engineering culture
  - Recent news
  - Benefits and work culture summary

## How Your CV is Processed

When you apply for a job, your CV goes through this pipeline:

```
Upload PDF
  ↓
AI extracts structured data (name, skills, experience, education)
  ↓
Embedded hyperlinks extracted (GitHub, LinkedIn, portfolio URLs)
  ↓
URLs classified by AI (portfolio vs company vs project vs blog)
  ↓
GitHub profile enriched via API (repos, languages, AI project analysis)
  ↓
AI scores you against job requirements (0-100 score)
  ↓
Recruiter reviews your profile with full context
```

Your LinkedIn profile, portfolio, and other links can be enriched on-demand by the recruiter for deeper analysis.

## API Endpoints

### Public Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/jobs/public?page=1&limit=10` | Browse active jobs (paginated) |
| `GET` | `/jobs/:id` | View job detail |
| `POST` | `/jobs/:jobId/candidates/upload` | Apply with CV |

### Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/discovery/jobs` | Search jobs by skills/title/location |
| `POST` | `/discovery/company-research` | Research a company |

## Tips for Candidates

- **Include your GitHub link** in your CV — the system automatically fetches your repos, languages, and commit activity for a stronger profile
- **Include your LinkedIn URL** — recruiters can enrich your profile with LinkedIn data
- **Use the Job Discovery** feature to find opportunities you might miss on individual job boards
- **Research companies** before applying to tailor your application
