# Features Documentation

Complete list of all features in AI Recruitment Copilot.

---

## 1. Authentication & Multi-Company

### Register
- Recruiter creates account with name, email, password, and company name
- If company doesn't exist, it's created automatically
- If company exists, recruiter joins it
- Returns JWT token for authenticated requests

### Login
- Email + password authentication
- Returns JWT token (7 days expiry) + user profile with company info
- Navbar shows `Name · Company Name` and Logout button

### Company Isolation
- Each company has its own jobs and candidates
- `GET /jobs` returns only your company's jobs
- Candidates uploaded to a job belong to that job's company

---

## 2. Job Management

### Create Job
- **Title** — e.g. "Senior Backend Engineer (Node.js)"
- **Description** — Full markdown support: headings, bold, lists, tables, code blocks
  - Write/Preview tabs for markdown editing
- **Requirements** — One per line, stored as array
- **Screening Criteria** (optional) — Private recruiter notes
  - Labeled "Internal only" — candidates never see this
  - Used by AI for scoring (e.g. "prefer fintech experience, red flag: job hopping")
  - Example: "Must have GitHub with real projects, not just tutorials"

### Edit Job
- Edit button on job detail page
- Inline form with all fields pre-filled
- Save updates immediately

### Active/Inactive Toggle
- Each job card shows Active/Inactive button
- Inactive jobs: hidden from careers page, appear dimmed in recruiter dashboard
- Toggle without deleting — preserves candidates and data

### Paginated Public Listing
- `GET /jobs/public?page=1&limit=10`
- Only active jobs
- Newest first (createdAt DESC)
- Returns `{ data, total, hasMore }`

---

## 3. Candidate Processing Pipeline

### Upload
- Recruiter uploads PDF on job detail page, or
- Candidate applies via careers portal (name + email + PDF)
- PDF stored in MinIO (S3-compatible)
- Candidate record created immediately with `uploaded` status
- All heavy processing queued to BullMQ worker

### Processing Pipeline (async worker)

```
Step 1: CV Parsing (OpenAI)
├── Send PDF as base64 to GPT-4o-mini
├── Extract: name, email, phone, summary, skills[], experience[], education[]
├── Extract: GitHub URL, LinkedIn URL, portfolio URLs
└── Status: uploaded → parsed

Step 2: Profile Enrichment (parallel)
├── GitHub (via GitHub REST API):
│   ├── Fetch user profile (bio, company, followers)
│   ├── Fetch repos (sorted by recently updated)
│   ├── For top 3 repos: fetch README, languages, recent commits
│   └── AI analyze: tech depth, project quality, activity level
├── LinkedIn (via TinyFish SSE, stealth mode):
│   ├── Try public view URL (?trk=people_guest_people_search-card)
│   ├── Fallback: Google search/cache
│   ├── Fallback: Yandex Translate
│   └── Extract: headline, summary, experience, skills, education
└── Status: parsed → enriching → enriched

Step 3: AI Scoring (OpenAI)
├── Build prompt with: job description + requirements + screening criteria
│   + parsed CV data + GitHub data + LinkedIn data
├── GPT-4o-mini returns: score, explanation, strengths, gaps, recommendation
└── Status: enriched → scoring → completed
```

### Error Handling
- If enrichment fails → skip, continue to scoring (score based on CV only)
- If any step fails → status set to `error` with error message
- BullMQ automatic retry: 3 attempts with exponential backoff (5s, 10s, 20s)
- Manual retry button on frontend (max 3 manual retries)
- Server restart → stuck candidates reset to `error` with "Click retry" message

### Progress Tracking
- Worker saves progress logs to `progressLogs` (jsonb array)
- Frontend polls every 3 seconds during processing
- Logs show: "[GitHub] Fetching repos...", "[LinkedIn] Bypassing authwall...", etc.
- Displayed in scrollable log box on candidate detail page

---

## 4. AI-Powered CV Parsing

### How It Works
- PDF sent as base64 to OpenAI GPT-4o-mini using file input API
- No local PDF parsing library needed — OpenAI reads the PDF natively
- Handles complex layouts, multi-column CVs, tables, images

### What's Extracted
| Field | Description |
|-------|-------------|
| Name | Full name |
| Email | Email address |
| Phone | Phone number |
| GitHub | GitHub profile URL |
| LinkedIn | LinkedIn profile URL |
| Portfolio | Other URLs (personal site, blog, etc.) |
| Summary | Professional summary / objective |
| Skills | List of all technical and soft skills |
| Experience | Each job: title, company, duration, description |
| Education | Each entry: degree, school, year |
| Raw Text | Full text extraction for scoring |

### Override
- When candidate applies via careers portal, their form name/email override AI-parsed values
- Ensures accurate contact info even if CV parsing misses something

---

## 5. GitHub Enrichment (via GitHub API)

### Data Fetched
- User profile: bio, company, location, followers count
- All non-fork repos sorted by recently updated
- For top 3 most active repos:
  - Languages breakdown (bytes per language)
  - Full README content
  - Commit count in last 90 days

### AI Analysis
- OpenAI analyzes the top repos and produces:
  - Tech stack assessment
  - Code activity level
  - Project quality evaluation
  - Developer skill summary

### Display
- Top languages as badges
- Total stars and contribution count
- Repository list with language, stars, description
- AI summary in the enrichment raw data (used for scoring)

---

## 6. LinkedIn Enrichment (via TinyFish)

### 3-Method Fallback Strategy
1. **Direct public view** — `?trk=people_guest_people_search-card` URL
2. **Google search** — `site:linkedin.com/in/ "Name"` + cached page
3. **Yandex Translate** — paste LinkedIn URL, bypass login wall

### Stealth Mode
- Uses `browser_profile: 'stealth'` for anti-detection
- TinyFish agent looks like a real browser

### Data Extracted
| Field | Description |
|-------|-------------|
| Headline | Job title / tagline below name |
| Summary | About section |
| Experience | Job title, company, duration, description |
| Skills | Listed skills |
| Education | Degree, school, years |
| Activity | Recent posts/reposts |

### Known Limitation
- LinkedIn aggressively blocks bots — some profiles may not return full data
- System gracefully handles partial data

---

## 7. Extended Enrichment (On-Demand)

Recruiter selects which analysis types to run from the "Extended Analysis" tab.

### Portfolio Analysis
- **Input:** Portfolio URLs from CV
- **TinyFish visits:** Personal website / portfolio
- **Output:** Online status, tech stack detected, design quality (professional/good/basic/template), responsive check, summary

### Live Project Check
- **Input:** Project URLs from GitHub repos + CV portfolio links
- **TinyFish visits:** Deployed web applications
- **Output:** Online status, tech detected (React, Vue, etc.), UI quality, feature list, summary

### Blog Analysis
- **Input:** Blog URLs (dev.to, Medium, Hashnode, personal blog)
- **TinyFish visits:** Blog/article page
- **Output:** Platform, total posts, recent 5 posts with tags, topic focus, writing quality assessment

### Stack Overflow Profile
- **Input:** Stack Overflow URL from CV
- **TinyFish visits:** SO profile page
- **Output:** Reputation, badge counts (gold/silver/bronze), top tags with scores, answer count, summary

### Work Verification
- **Input:** Top 3 companies from parsed CV experience
- **TinyFish:** Googles company → visits company website → looks for team/about page
- **Output:** Verified (true/false/null), evidence description, company URL

---

## 8. AI Match Scoring

### Scoring Inputs
| Source | What's Included |
|--------|----------------|
| Job | Description (markdown), requirements list, screening criteria |
| CV | Parsed skills, experience, education (structured) |
| GitHub | Top languages, repos, stars, contributions, AI project analysis |
| LinkedIn | Headline, experience, skills |
| Extended | Portfolio, live projects, blog, SO, verification (when available) |

### Scoring Output
| Field | Description |
|-------|-------------|
| `overallScore` | 0-100 numeric score |
| `recommendation` | strong_match (80+), good_match (60+), partial_match (40+), weak_match (<40) |
| `explanation` | 2-3 paragraph detailed analysis |
| `strengths` | Array of specific positive signals |
| `gaps` | Array of missing qualifications |

### Score Transparency
- Badge row shows what data the score was based on
- Warning badge if enrichment data is missing ("score may improve with re-enrich")
- Re-enrich button to fetch fresh data and re-score

---

## 9. Queue System (BullMQ)

### Job Types
| Type | Trigger | What Happens |
|------|---------|-------------|
| Full pipeline | CV upload | Parse → Enrich → Score |
| Re-enrich | Re-enrich button | Fetch GitHub/LinkedIn → Re-score |
| Extended enrich | Extended analysis | Run selected types → Re-score |

### Configuration
- Redis 7 backend
- 3 automatic retries with exponential backoff
- Keep last 200 completed jobs, last 100 failed jobs
- Progress tracking with percentage updates

### Monitoring
- Bull Board dashboard at `/queues/`
- Shows: waiting, active, completed, failed jobs
- Job details: data, progress, logs, attempts

### Server Restart Recovery
- On startup, `StartupService` finds all candidates stuck in processing states
- Resets them to `error` with message "Processing interrupted by server restart"
- Recruiter can click Retry to re-queue

---

## 10. Recruiter Dashboard

### Jobs List (`/`)
- Grid view of all company jobs
- Each card shows: title, description preview, requirement count, screening criteria badge
- Active/Inactive toggle per job
- "New Job" form with markdown editor

### Job Detail (`/jobs/:id`)
- Tabs: Job Description | Candidates | Screening Criteria
- JD rendered as formatted markdown
- Candidates list with: name, email, status badge, match score, recommendation badge
- Upload CV button
- Edit Job button (inline form)

### Candidate Detail (`/jobs/:id/candidates/:id`)
- Header: name, email/phone, GitHub/LinkedIn badges, score + recommendation
- Status card with progress logs during processing
- Error card with retry button (shows retry count x/3)
- Tabs:
  - **Match Score** — Score basis badges, explanation, strengths/gaps cards
  - **Parsed CV** — Summary, skills badges, experience timeline, education
  - **Enriched Profile** — GitHub repos/languages, LinkedIn headline/experience, re-enrich button with confirmation dialog
  - **Extended Analysis** — Checkbox selection for analysis types, results cards
  - **Raw CV** — Plain text extraction
  - **PDF** — Embedded PDF viewer via MinIO presigned URL

---

## 11. Candidate Portal

### Careers Page (`/careers`)
- Public, no login required
- Infinite scroll (10 jobs per page, loads more on scroll)
- Only active jobs shown
- Each job shows: title, company name, markdown description (expand/collapse), requirements badges
- "Apply Now" button per job

### Apply Page (`/careers/:id/apply`)
- Company name shown
- Form: Full Name, Email, CV upload (PDF)
- All fields required
- Confirmation page after submit: "We'll review your profile and get back to you at {email}"

---

## 12. Demo Data (Auto-Seed)

On first API start, automatically creates:
- **3 companies:** Acme Corp, Moonlight Labs, Nova Systems
- **3 demo accounts:** hr@acme.example, hr@moonlight.example, hr@nova.example (password: 123456)
- **50 jobs** across all companies:
  - 8 detailed jobs with rich markdown JDs and screening criteria
  - 42 bulk jobs for infinite scroll demo
  - ~15% inactive (to demo filtering)
- Roles span: Backend, Frontend, DevOps, ML, Data, Mobile, QA, Java, Go, Rust, and more
