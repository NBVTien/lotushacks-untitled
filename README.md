# AI Recruitment Copilot (Beyond CV)

Go beyond the resume — enrich candidates with real-world data, discover jobs across platforms, and make explainable hiring decisions powered by AI.

## Two Platforms

| Platform | Audience | URL |
|----------|----------|-----|
| **Recruiter Dashboard** | HR / Hiring managers | [localhost:5173](http://localhost:5173) |
| **Candidate Portal** | Job seekers | [localhost:5173/careers](http://localhost:5173/careers) |

See detailed guides:
- [Recruiter Guide](docs/RECRUITER.md) — manage jobs, evaluate candidates, source talent
- [Candidate Guide](docs/CANDIDATE.md) — apply for jobs, discover opportunities, research companies

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 11, TypeORM, Passport JWT, BullMQ |
| Database | PostgreSQL 16, Redis 7 |
| Storage | MinIO (S3-compatible) |
| AI | OpenAI GPT-4o-mini |
| Web Intelligence | TinyFish API (parallel browser agents) |

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

### Demo Accounts

| Email | Password | Company |
|-------|----------|---------|
| `hr@acme.example` | `123456` | Acme Corp |
| `hr@moonlight.example` | `123456` | Moonlight Labs |
| `hr@nova.example` | `123456` | Nova Systems |

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
│  NestJS API (localhost:4005)                         │
│  ├── auth/         JWT authentication                │
│  ├── jobs/         Job CRUD                          │
│  ├── candidates/   CV upload, parsing, scoring       │
│  ├── enrichment/   GitHub API + TinyFish crawling    │
│  ├── matching/     OpenAI scoring engine             │
│  └── discovery/    Job search, company intel,        │
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

## License

MIT
