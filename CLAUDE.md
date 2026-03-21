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
  ├── candidates/    CV upload (MinIO), PDF parsing, link extraction
  ├── enrichment/    TinyFish API → crawl GitHub/LinkedIn profiles
  └── matching/      OpenAI GPT-4o-mini → match score + explanation

shared/ (TypeScript interfaces consumed by both api and web)
  └── src/types.ts   Job, Candidate, MatchResult, EnrichedProfile, etc.
```

### Candidate Processing Pipeline

Fire-and-forget async after upload:
`uploaded → parsed → enriching → enriched → scoring → completed`

The frontend polls every 5 seconds to reflect status changes.

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

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `OPENAI_API_KEY` — required for match scoring
- `TINYFISH_API_KEY` — required for GitHub/LinkedIn enrichment
- Database and MinIO defaults work with docker-compose as-is
