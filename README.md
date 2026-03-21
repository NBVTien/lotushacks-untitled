# TalentLens — AI Recruitment Copilot

<div align="center">

**See candidates clearly through AI.** Enrich profiles with real-world data, discover jobs across platforms, and make explainable hiring decisions — all powered by AI.

[![Built with TinyFish](https://img.shields.io/badge/Built%20with-TinyFish-blue?style=for-the-badge)](https://tinyfish.ai)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com)

</div>

---

## The Problem

Recruiters spend hours manually checking GitHub profiles, LinkedIn pages, and portfolio sites. Candidates waste time searching dozens of job boards one by one. Both sides lack context.

## The Solution

A two-sided platform where **AI does the legwork**:

### For Recruiters

- **Upload a CV** → AI parses it, fetches the candidate's GitHub profile, and scores them against job requirements — all in seconds
- **Deep enrichment on demand** → Click to crawl LinkedIn, analyze portfolios, check blog activity, verify companies from work history — each runs independently with live progress streaming
- **Source candidates** → TinyFish browser agents search ITviec, TopDev, and LinkedIn in parallel to find matching talent

### For Candidates

- **AI Job Discovery** → Enter your skills and location, and browser agents crawl multiple job boards simultaneously to surface matching positions you'd never find manually
- **Company Research** → Before you apply, get Glassdoor reviews, tech stack info, and culture insights — all fetched live

## How TinyFish Powers It

[TinyFish](https://tinyfish.ai) provides SOTA web agents as an API — send a URL + a goal in plain English, get structured JSON back. This project uses it for:

| Feature | TinyFish Usage |
|---------|---------------|
| LinkedIn enrichment | Stealth browser crawls LinkedIn profiles (bypasses login walls) |
| Portfolio analysis | Visits personal websites, detects tech stack, checks design quality |
| Blog analysis | Crawls dev.to, Medium, Hashnode for writing quality and topics |
| Company intelligence | Verifies companies from CV, checks tech stack and industry |
| Job discovery | 3 agents crawl ITviec, TopDev, LinkedIn Jobs in parallel |
| Company research | Agents fetch Glassdoor reviews, tech blogs, company info |
| Candidate sourcing | Agents search job platforms for matching candidate profiles |

All TinyFish calls run in **parallel** with **SSE streaming** so users see live progress as agents browse the web.

## Quick Start

```bash
# Install
git clone <repo-url> && cd lotushacks-untitled && npm install

# Configure
cp .env.example .env
# Add your OPENAI_API_KEY and TINYFISH_API_KEY

# Start infrastructure
docker compose up -d

# Run
npm run dev
```

Open [localhost:5173](http://localhost:5173) (recruiter) or [localhost:5173/careers](http://localhost:5173/careers) (candidate).

## Platform Guides

| Guide | For |
|-------|-----|
| [Recruiter Guide](docs/RECRUITER.md) | Manage jobs, evaluate candidates, source talent |
| [Candidate Guide](docs/CANDIDATE.md) | Apply for jobs, discover opportunities, research companies |

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 11, TypeORM, BullMQ |
| Database | PostgreSQL 16, Redis 7 |
| Storage | MinIO (S3-compatible) |
| AI | OpenAI GPT-4o-mini |
| Web Intelligence | [TinyFish](https://tinyfish.ai) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Candidate Portal              │  Recruiter Dashboard│
│  - Browse & apply              │  - Manage jobs       │
│  - Discover jobs (AI)          │  - Evaluate CVs      │
│  - Research companies          │  - Source candidates  │
└────────────────┬────────────────────────┬────────────┘
                 │        REST API        │
┌────────────────┴────────────────────────┴────────────┐
│  NestJS API                                          │
│  ├── candidates/   CV parsing, enrichment, scoring   │
│  ├── discovery/    Job search, sourcing, research    │
│  ├── enrichment/   GitHub API + TinyFish             │
│  └── matching/     OpenAI scoring engine             │
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
