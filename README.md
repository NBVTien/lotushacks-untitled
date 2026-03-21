# AI Recruitment Copilot (Beyond CV)

Go beyond the resume — enrich candidates with real-world data, discover jobs across platforms, and make explainable hiring decisions powered by AI.

## What It Does

**For Recruiters:**
- Upload a CV → AI parses it, fetches GitHub profile, and scores the candidate against job requirements
- On-demand enrichment: LinkedIn crawl, portfolio analysis, blog analysis, company verification — each runs async with live progress streaming
- Source candidates proactively — TinyFish agents search ITviec, TopDev, LinkedIn in parallel

**For Candidates:**
- Browse and apply for jobs via the public careers portal
- AI Job Discovery — enter your skills, and browser agents crawl multiple job boards simultaneously to find matching positions
- Company Research — before applying, get Glassdoor reviews, tech stack, culture info

## How It Works

```
CV Upload → AI Parse → GitHub Enrich (immediate) → AI Score → Done
                ↓
    Extract embedded hyperlinks (LinkedIn, GitHub, company URLs)
    Classify URLs by kind (portfolio / company / project / blog)
                ↓
    On-demand: LinkedIn, portfolio, blog, SO, company intel
    Each runs independently via TinyFish browser agents
```

**Job Discovery** (for candidates):
```
Skills + Location → 3 TinyFish agents crawl job boards in parallel → matching jobs
```

**Candidate Sourcing** (for recruiters):
```
Job requirements → 3 TinyFish agents search platforms in parallel → candidate profiles
```

## Two Platforms

| Platform | Audience | Route |
|----------|----------|-------|
| **Recruiter Dashboard** | HR / Hiring managers | `/` |
| **Candidate Portal** | Job seekers | `/careers` |

- [Recruiter Guide](docs/RECRUITER.md) — manage jobs, evaluate candidates, source talent
- [Candidate Guide](docs/CANDIDATE.md) — apply for jobs, discover opportunities, research companies

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 11, TypeORM, Passport JWT, BullMQ |
| Database | PostgreSQL 16, Redis 7 |
| Storage | MinIO (S3-compatible) |
| AI | OpenAI GPT-4o-mini (CV parsing, scoring, URL classification) |
| Web Intelligence | [TinyFish API](https://tinyfish.ai) (parallel browser agents for enrichment, job discovery, sourcing) |

## Quick Start

```bash
# 1. Install
git clone <repo-url> && cd lotushacks-untitled && npm install

# 2. Configure
cp .env.example .env
# Edit .env → add OPENAI_API_KEY and TINYFISH_API_KEY

# 3. Start infrastructure
docker compose up -d    # PostgreSQL + MinIO + Redis

# 4. Run
npm run dev             # API on :4005, Frontend on :5173
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Candidate Portal (/careers)   │  Recruiter Dashboard│
│  - Browse & apply              │  - Manage jobs       │
│  - Discover jobs (AI)          │  - Evaluate CVs      │
│  - Research companies          │  - Source candidates  │
└────────────────┬────────────────────────┬────────────┘
                 │        REST API        │
┌────────────────┴────────────────────────┴────────────┐
│  NestJS API                                          │
│  ├── auth/         JWT authentication                │
│  ├── jobs/         Job CRUD                          │
│  ├── candidates/   CV upload, parsing, SSE streaming │
│  ├── enrichment/   GitHub API + TinyFish crawling    │
│  ├── matching/     OpenAI scoring engine             │
│  └── discovery/    Job search, company research,     │
│                    candidate sourcing (TinyFish)      │
├──────────────────────────────────────────────────────┤
│  PostgreSQL │ MinIO │ Redis + BullMQ                 │
└──────────────────────────────────────────────────────┘
         │                              │
    ┌────┴────┐                  ┌──────┴──────┐
    │ OpenAI  │                  │  TinyFish   │
    │ GPT-4o  │                  │  Browser    │
    │ -mini   │                  │  Agents     │
    └─────────┘                  └─────────────┘
```

## Project Structure

```
├── api/                  # NestJS backend
│   └── src/
│       ├── auth/         # Register, login, JWT
│       ├── candidates/   # CV upload, parsing, enrichment pipeline
│       ├── enrichment/   # GitHub API, TinyFish crawl, extended enrichment
│       ├── discovery/    # Job discovery, company research, candidate sourcing
│       ├── matching/     # OpenAI scoring
│       └── jobs/         # Job CRUD
├── web/                  # React frontend
│   └── src/
│       ├── pages/        # All pages (recruiter + candidate)
│       ├── components/   # shadcn/ui components
│       └── lib/          # API client, auth context
├── shared/               # Shared TypeScript types
└── docker-compose.yml    # PostgreSQL + MinIO + Redis
```

## License

MIT
