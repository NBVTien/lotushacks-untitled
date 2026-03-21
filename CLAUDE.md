# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Recruitment Copilot — upload a CV, enrich it with real-world data (GitHub/LinkedIn), and get an explainable hiring decision. Monorepo with three npm workspaces: `api/` (NestJS), `web/` (React/Vite), `shared/` (TypeScript types).

## Commands

```bash
# Prerequisites: Docker must be running
docker compose up -d              # Start PostgreSQL + MinIO

# Development
npm run dev:api                   # NestJS API on http://localhost:4005
npm run dev:web                   # Vite dev server on http://localhost:5173
npm run dev                       # Both workspaces in parallel

# Build
npm run build:api                 # nest build
npm run build:web                 # tsc -b && vite build

# Lint & Format
npm run lint                      # ESLint across all workspaces
npm run format                    # Prettier across all workspaces

# Type-check without emitting
npx tsc --noEmit -p api/tsconfig.json
npx tsc --noEmit -p web/tsconfig.app.json
```

No test framework is currently configured.

## Architecture

```
web/ (React 19 + Vite 8 + Tailwind 4 + shadcn/ui)
  → Axios calls to http://localhost:4005
  → Two audiences: recruiter dashboard (/) and candidate portal (/careers)

api/ (NestJS 11 + TypeORM + PostgreSQL 16)
  ├── jobs/          CRUD for job descriptions
  ├── candidates/    CV upload (MinIO), PDF parsing, link extraction, SSE streaming
  ├── enrichment/    GitHub API + TinyFish → crawl profiles, portfolio, company intel
  ├── matching/      OpenAI GPT-4o-mini → match score + explanation
  └── discovery/     TinyFish-powered job discovery, company research, candidate sourcing

shared/ (TypeScript interfaces consumed by both api and web)
  └── src/types.ts   Job, Candidate, MatchResult, EnrichedProfile, Discovery types, etc.
```

### Candidate Processing Pipeline

Fire-and-forget async after upload:
`uploaded → parsed → GitHub enrichment (immediate) → scoring → completed`

Extended enrichment (LinkedIn, portfolio, blog, SO, company intel) runs on-demand per type via independent BullMQ jobs. Progress is streamed via SSE (`GET /candidates/:id/enrichment-stream`).

### Discovery Module (TinyFish-powered)

Three features powered by parallel TinyFish agents (all use SSE streaming):
- **Job Discovery** (`POST /discovery/jobs`, `POST /discovery/jobs-from-upload`) — Candidate skills or CV → crawl Upwork, Wellfound → matching job listings ranked by AI
- **Company Research** (`POST /discovery/company-research`) — Company name → crawl Glassdoor, tech blog, website → company intelligence
- **Candidate Sourcing** (`POST /discovery/source-candidates`) — Job requirements → crawl LinkedIn, Upwork, Toptal → matching candidate profiles

Frontend routes:
- `/careers/discover` — Job discovery for candidates
- `/careers/company/:name` — Company research for candidates
- `/jobs/:jobId/source` — Candidate sourcing for recruiters

### Database

TypeORM with `synchronize: true` — entities auto-create tables. Two tables:
- `jobs` — title, description, requirements (text array)
- `candidates` — links to job, stores cvText, links (jsonb), enrichment (jsonb), matchResult (jsonb)

### Key Conventions

- **API modules** follow NestJS pattern: `module.ts` + `controller.ts` + `service.ts` per feature
- **Web pages** live in `web/src/pages/`, API client in `web/src/lib/api.ts`
- **Shared types** are imported as `@lotushack/shared` (npm workspace link)
- **Path alias**: `@/` maps to `web/src/` in the frontend
- **Config**: NestJS `ConfigModule` reads `../.env` from the api directory
- API uses **CommonJS** (`module: "commonjs"`), web uses **ESNext** modules

### Working with Claude Code

- **Always split BE + FE into 2 parallel agents** — when implementing features that span both backend and frontend, launch one agent for `api/` changes and another for `web/` changes. They work on non-overlapping files and can run concurrently.
- Type-check both after agents complete: `npx tsc --noEmit -p api/tsconfig.json` and `npx tsc --noEmit -p web/tsconfig.app.json`
- **Always update documentation** — after implementing or changing features, update README.md, CLAUDE.md, and any relevant docs in `docs/` (RECRUITER.md, CANDIDATE.md, etc.) to reflect the changes. Documentation must stay in sync with the codebase.

### TinyFish Platform Selection

- **Candidate Sourcing**: LinkedIn (stealth), Upwork (stealth), Toptal (lite)
- **Job Discovery**: Upwork, Wellfound
- **Company Research**: Glassdoor, tech blog, company website

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `OPENAI_API_KEY` — required for match scoring
- `TINYFISH_API_KEY` — required for GitHub/LinkedIn enrichment
- Database and MinIO defaults work with docker-compose as-is
