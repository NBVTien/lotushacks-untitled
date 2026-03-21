# AI Recruitment Copilot (Beyond CV)

Upload a CV, enrich it with real-world data from GitHub & LinkedIn, and get an explainable hiring decision.

## Features

- **Multi-company support** — Each company has its own recruiters and job listings
- **Authentication** — Register/login with JWT, company-scoped data
- **Job Descriptions with Markdown** — Rich text JDs with headings, tables, lists, and formatting
- **Screening Criteria** — Private recruiter notes that AI uses for scoring but candidates never see
- **Job Active/Inactive toggle** — Turn off jobs without deleting them; inactive jobs hidden from candidates
- **AI-powered CV Parsing** — OpenAI extracts structured data (skills, experience, education) from PDF
- **Profile Enrichment** — Crawl GitHub and LinkedIn via TinyFish API (batch + sync)
- **AI Match Scoring** — GPT-4o-mini evaluates candidate-job fit with score, strengths, gaps, and explanation
- **BullMQ Worker** — Async candidate processing with retries, progress tracking, and Redis persistence
- **Bull Board** — Queue monitoring dashboard at `/queues/`
- **Recruiter Dashboard** — View candidates, parsed CV, scores, enriched profiles, and screening criteria
- **Candidate Portal** — Public careers page with infinite scroll

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, shadcn/ui, react-markdown |
| Backend | NestJS 11, TypeORM, Passport JWT |
| Queue | BullMQ + Redis 7, Bull Board |
| Database | PostgreSQL 16 |
| File Storage | MinIO (S3-compatible) |
| AI | OpenAI GPT-4o-mini (CV parsing + scoring) |
| Enrichment | TinyFish API (sync + batch async) |

## Prerequisites

- **Node.js** >= 20
- **Docker** (for PostgreSQL, MinIO, and Redis)
- **OpenAI API key**
- **TinyFish API key** — get from [tinyfish.ai](https://tinyfish.ai)

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd lotushacks-untitled
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

```env
# These work out of the box with docker-compose
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=recruitment

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cvs

REDIS_HOST=localhost
REDIS_PORT=6379

# Required — get your keys
TINYFISH_API_KEY=sk-tinyfish-xxx
OPENAI_API_KEY=sk-xxx
```

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **MinIO** on port `9000` (console at `9001`)
- **Redis** on port `6379`

### 4. Start the application

```bash
# Terminal 1 — API
npm run dev:api
# Runs on http://localhost:4005

# Terminal 2 — Frontend
npm run dev:web
# Runs on http://localhost:5173
```

Or start both at once:

```bash
npm run dev
```

### 5. Open the app

- **Recruiter Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Candidate Portal**: [http://localhost:5173/careers](http://localhost:5173/careers)
- **Queue Monitor**: [http://localhost:4005/queues](http://localhost:4005/queues)

### Demo Accounts

The database seeds automatically on first start with 3 companies, 50 jobs, and demo accounts:

| Email | Password | Company |
|-------|----------|---------|
| `hr@acme.example` | `123456` | Acme Corp |
| `hr@moonlight.example` | `123456` | Moonlight Labs |
| `hr@nova.example` | `123456` | Nova Systems |

## How It Works

```
1. Recruiter creates a Job Description (Markdown) + optional Screening Criteria
2. Candidate uploads CV (PDF) via Careers portal — or recruiter uploads on their behalf
3. OpenAI parses CV into structured data (name, skills, experience, education, links)
4. BullMQ worker picks up the job:
   a. TinyFish crawls GitHub/LinkedIn profiles in parallel (batch API)
   b. OpenAI scores candidate vs job requirements + screening criteria
5. Dashboard shows parsed CV, match score, explanation, strengths/gaps
```

### Candidate Processing Pipeline

```
uploaded → parsed → [queued] → enriching → enriched → scoring → completed
                                                                    ↓
                                                                  error (retries up to 3x)
```

- Processing runs via **BullMQ worker** with 3 retries and exponential backoff
- Dashboard auto-refreshes every 5 seconds to reflect progress
- Monitor queue at `/queues/` (Bull Board)

### TinyFish API Integration

| Links Found | Strategy | Endpoint |
|-------------|----------|----------|
| 1 link (GitHub or LinkedIn) | Sync — wait for result | `POST /v1/automation/run` |
| 2 links (GitHub + LinkedIn) | Batch — submit both, poll for results | `POST /v1/automation/run-batch` + `POST /v1/runs/batch` |

## Project Structure

```
├── api/                 # NestJS backend
│   └── src/
│       ├── auth/        # Register, login, JWT guard
│       ├── database/    # TypeORM entities (Company, User, Job, Candidate)
│       ├── jobs/        # Job CRUD (company-scoped, active/inactive toggle)
│       ├── candidates/  # CV upload, AI parsing, MinIO storage, BullMQ queue
│       ├── enrichment/  # TinyFish sync + batch integration
│       ├── matching/    # OpenAI scoring engine
│       └── seed/        # Auto-seed demo data (3 companies, 50 jobs)
├── web/                 # React frontend
│   └── src/
│       ├── pages/       # Login, Register, Jobs, JobDetail, CandidateDetail, Careers, Apply
│       ├── components/  # shadcn/ui components
│       └── lib/         # API client, auth context
├── shared/              # Shared TypeScript types
│   └── src/types.ts
├── .ideas/              # Product vision and future feature ideas
├── docker-compose.yml   # PostgreSQL + MinIO + Redis
└── .env.example         # Environment template
```

## API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register (name, email, password, companyName) |
| `POST` | `/auth/login` | Login → returns JWT token |
| `GET` | `/auth/me` | Get current user (protected) |

### Jobs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/jobs` | Yes | Create job (title, description, requirements, screeningCriteria) |
| `GET` | `/jobs` | Yes | List jobs for your company |
| `GET` | `/jobs/public?page=1&limit=10` | No | Paginated active jobs (for careers page) |
| `GET` | `/jobs/:id` | No | Get job with candidates |
| `PATCH` | `/jobs/:id/toggle` | Yes | Toggle job active/inactive |
| `DELETE` | `/jobs/:id` | Yes | Delete a job |

### Candidates

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs/:jobId/candidates/upload` | Upload CV (multipart, field: `cv`) |
| `GET` | `/jobs/:jobId/candidates` | List candidates for a job |
| `GET` | `/jobs/:jobId/candidates/:id` | Get candidate details (parsed CV, enrichment, score) |
| `DELETE` | `/jobs/:jobId/candidates/:id` | Delete a candidate |

### Monitoring

| URL | Description |
|-----|-------------|
| `/queues/` | Bull Board — queue monitoring dashboard |

## Documentation

| Document | Description |
|----------|-------------|
| [Pain Points & Solutions](docs/PAIN-POINTS.md) | User problems and how the app solves them |
| [Features](docs/FEATURES.md) | Complete feature list with detailed descriptions |
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, DB schema, external APIs |
| [API Reference](docs/API.md) | All API endpoints with request/response examples |
| [Seed Data](SEED.md) | Demo accounts, companies, and sample jobs |
| [Product Vision](.ideas/product-vision.md) | Original product spec and MVP scope |
| [Future Features](.ideas/future-features.md) | Backlog of planned features |

## License

MIT
