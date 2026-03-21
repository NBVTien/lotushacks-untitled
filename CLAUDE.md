# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Two-sided AI career platform — recruiters upload CVs, enrich with real-world data (GitHub/LinkedIn), and get explainable hiring decisions. Candidates register, upload their CV, run AI gap analysis against job descriptions, and get TinyFish-powered learning resources. JWT auth with role-based access (`recruiter` / `candidate`). Monorepo with three npm workspaces: `api/` (NestJS), `web/` (React/Vite), `shared/` (TypeScript types).

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
  → Two audiences: candidate portal (/, /portal) and recruiter dashboard (/recruiter)

api/ (NestJS 11 + TypeORM + PostgreSQL 16)
  ├── jobs/          CRUD for job descriptions
  ├── candidates/    CV upload (MinIO), PDF parsing, link extraction, SSE streaming
  ├── enrichment/    GitHub API + TinyFish → crawl profiles, portfolio, company intel
  ├── matching/           OpenAI GPT-4o-mini → match score + explanation
  ├── discovery/          TinyFish-powered job discovery, company research, candidate sourcing
  └── candidate-portal/   CV profile, saved JDs, gap analysis, learning resources

shared/ (TypeScript interfaces consumed by both api and web)
  └── src/types.ts   Job, Candidate, MatchResult, EnrichedProfile, Discovery types, etc.
```

### Candidate Processing Pipeline

Fire-and-forget async after upload:
`uploaded → parsed → GitHub enrichment (immediate) → scoring → completed`

Extended enrichment (LinkedIn, portfolio, blog, SO, company intel) runs on-demand per type via independent BullMQ jobs. Progress is streamed via SSE (`GET /candidates/:id/enrichment-stream`).

### Discovery Module (TinyFish-powered)

Company research powered by TinyFish agents (SSE streaming):
- **Company Research** (`POST /discovery/company-research`) — Company name → crawl Glassdoor, tech blog, website → company intelligence

Frontend routes:
- `/company/:name` — Company research for candidates

### Candidate Portal Module

Authenticated candidate features (JWT with `role: 'candidate'`):
- **CV Profile** — Upload CV, parsed with OpenAI. Stored on UserEntity (cvText, parsedCV). Endpoints: `POST /candidate-portal/cv`, `GET /candidate-portal/profile`
- **Saved JDs** — Save job descriptions (from platform or pasted). Endpoints: `POST/GET/DELETE /candidate-portal/saved-jds`
- **Gap Analysis** — Compare CV against a JD using MatchingService. Returns overall score, strengths, gaps, skill scores, improvement areas with priorities. Results persisted in `saved_jds.lastAnalysis`. UI has 3 tabs: Browse Jobs, Paste JD, History. Endpoint: `POST /candidate-portal/gap-analysis`
- **Learning Resources** — Per-skill on-demand, 3-step flow: (1) OpenAI analyzes gap → generates search keywords, (2) TinyFish crawls dev.to + GitHub with those keywords, (3) OpenAI synthesizes mentor-style summaries + key takeaways. Each skill runs independently. SSE streaming. Results cached in `saved_jds.lastResources` and loadable on refresh. Endpoints: `POST /candidate-portal/learning-resources/skill` (per-skill, supports `force` param), `POST /candidate-portal/learning-resources` (batch), `GET /candidate-portal/saved-jds/:id/resources` (cached results).

Frontend routes:
- `/login` — Candidate login
- `/register` — Candidate registration
- `/portal` — Profile + CV management
- `/portal/gap-analysis` — Gap analysis
- `/portal/gap-analysis/:id/resources` — Learning resources
- `/recruiter/login` — Recruiter login
- `/recruiter` — Recruiter dashboard (stats, recent activity)
- `/recruiter/jobs` — Jobs list (card/table view)

Seed candidate: toan@candidate.example / 123456

### Database

TypeORM with `synchronize: true` — entities auto-create tables. Key tables:
- `companies` — name, description, logo
- `users` — email, password, name, role (varchar, default 'recruiter'), companyId (nullable FK), cvText (text), parsedCV (jsonb)
- `jobs` — title, description, requirements (text array), companyId FK
- `candidates` — links to job, stores cvText, links (jsonb), enrichment (jsonb), matchResult (jsonb)
- `saved_jds` — userId FK, title, description, requirements, source, jobId (nullable FK), lastAnalysis (jsonb), lastResources (jsonb), createdAt

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
- **Always update documentation** — after implementing or changing features, update README.md, CLAUDE.md, and docs/ARCHITECTURE.md to reflect the changes. Documentation must stay in sync with the codebase.

### TinyFish Platform Selection

- **Company Research**: Glassdoor, tech blog, company website
- **Learning Resources**: dev.to (lite), GitHub (lite) → OpenAI mentor synthesis

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `OPENAI_API_KEY` — required for match scoring
- `TINYFISH_API_KEY` — required for GitHub/LinkedIn enrichment
- Database and MinIO defaults work with docker-compose as-is
