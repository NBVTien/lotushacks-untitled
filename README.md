# TalentLens — AI Career Platform powered by TinyFish

<div align="center">

**The recruitment process is broken on both sides.** Recruiters can't verify what candidates claim. Candidates can't learn why they fail. TalentLens uses [TinyFish](https://tinyfish.ai) web agents to fix both — by crawling the real internet for evidence.

[![Built with TinyFish](https://img.shields.io/badge/Built%20with-TinyFish-blue?style=for-the-badge)](https://tinyfish.ai)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com)

</div>

---

## The Real Problems

### Problem 1: Recruiters are flying blind

A recruiter receives 200 CVs for a Senior React Developer position. Every CV says "proficient in React." But:

- **How do you know it's real?** A CV says "5 years React experience" — but the candidate's GitHub has zero React repos and their last commit was 2 years ago. The recruiter has no time to check.
- **Signals are scattered across the internet.** The candidate's real skill level is shown on their GitHub, LinkedIn, dev.to blog, deployed portfolio, Stack Overflow reputation — not on a 2-page PDF. But visiting 5+ sites per candidate for 200 candidates? That's 1,000 browser tabs.
- **"Worked at TechCorp for 3 years"** — does TechCorp even exist? Is it a 5-person agency or a Fortune 500? The recruiter doesn't have time to Google every company on every CV.
- **Scoring is subjective.** Two recruiters read the same CV and come to different conclusions. There's no consistent framework, no explainability, no audit trail.

**The core issue:** Information about candidates exists on the public internet, but recruiters can't access it at scale. Manual verification doesn't scale. So they guess.

### Problem 2: Candidates are in the dark

A developer applies to 30 jobs and gets rejected from all of them. They never learn:

- **What skills they're actually missing.** The JD says "Kubernetes required" — do they have it or not? Their CV mentions Docker but not K8s. Is that a gap? How big?
- **What to learn and where.** Even if they know "learn Kubernetes," where do they start? Which blog post? Which open-source project? Generic advice isn't actionable.
- **What companies are really like.** They apply without knowing the tech stack, engineering culture, or Glassdoor reviews. They're applying blind.

**The core issue:** Candidates have no self-assessment tool that tells them exactly where they stand relative to a specific job, and no way to find targeted resources to close each gap.

---

## How TalentLens Solves It — with TinyFish

[TinyFish](https://tinyfish.ai) provides SOTA web agents as an API — send a URL + a goal in plain English, get structured data back via SSE streaming. TalentLens uses this to **automate what humans do manually on the internet**: verify, research, and discover.

### For Recruiters: Automated verification pipeline

```
Upload CV
  → AI parses it (OpenAI: skills, experience, links)
  → GitHub API fetches real repos, languages, commit activity
  → TinyFish crawls LinkedIn (stealth) to verify work history
  → AI scores the candidate with all evidence combined
  → Recruiter sees: 82/100, strengths, gaps, explainable recommendation
```

**Then, on demand, TinyFish goes deeper:**

| What the recruiter wonders | What TinyFish does |
|---|---|
| "Does this portfolio site actually work?" | Visits the URL, checks if it's online, detects tech stack (React? Vue?), evaluates design quality |
| "They say they blog on dev.to — is it real?" | Crawls their dev.to/Medium profile, counts posts, reads topics, assesses writing quality |
| "They deployed 3 projects — do they work?" | Visits each deployed app, checks if it loads, analyzes UI quality and features |
| "Is their Stack Overflow profile legit?" | Checks reputation, badges, top tags, answer count |
| "Did they really work at this company?" | Googles the company, visits the website, checks team/about pages, returns company intel |

**Before TalentLens:** 45 minutes per candidate, opening tabs, reading profiles, Googling companies.
**After TalentLens:** Upload CV, wait 30 seconds, get a verified, scored, explainable assessment.

### For Candidates: From rejection to roadmap

```
Upload CV → Select a JD → AI shows exactly what matches and what doesn't
  → Per-skill breakdown: React ✅ yes, Node.js ⚠️ partial, Kubernetes ❌ no
  → Prioritized improvement areas: Kubernetes (high), AWS (medium), GraphQL (low)
  → Click "Explore" on any skill gap
  → OpenAI analyzes the gap → generates targeted search keywords
  → TinyFish crawls dev.to + GitHub with those keywords
  → OpenAI synthesizes mentor-style advice: summaries, key takeaways, learning path
  → Results persisted in DB — revisit anytime, even after page refresh
```

| What the candidate wonders | What TinyFish does |
|---|---|
| "I'm missing Kubernetes — where do I start?" | TinyFish crawls dev.to, reads actual articles, then OpenAI generates mentor-style summary + key takeaways |
| "Any good open-source projects to learn from?" | TinyFish crawls GitHub repos, reads READMEs, then OpenAI explains what you'll learn and how to use them |
| "What's this company actually like?" | Crawls Glassdoor for reviews, tech blogs for engineering culture, company website for overview |

**Before TalentLens:** Apply everywhere, get rejected everywhere, don't know why, don't know how to improve.
**After TalentLens:** See exactly where you stand, what to improve first, and get specific resources to learn each skill.

---

## TinyFish Usage Summary

Every TinyFish call follows one pattern: URL + goal → SSE streaming → structured JSON.

| Use Case | Target | Mode | Who |
|----------|--------|------|-----|
| LinkedIn Enrichment | linkedin.com/in/xxx | stealth | Recruiter |
| Portfolio Analysis | Candidate's website | lite | Recruiter |
| Blog Analysis | dev.to / Medium / blog | lite | Recruiter |
| Live Project Check | Deployed web apps | lite | Recruiter |
| Company Verification | Google → company sites | lite | Recruiter |
| Company Research | Glassdoor, tech blogs | lite | Candidate |
| Learning Resources | dev.to + GitHub | lite | Candidate |

7 use cases. All SSE-streamed. All structured JSON output. All powered by one `TinyFishCrawlService`. Learning resources use a 3-step flow: OpenAI generates search keywords → TinyFish crawls → OpenAI synthesizes mentor advice. Results are cached in DB and persist across page refreshes.

---

## Quick Start

```bash
git clone <repo-url> && cd lotushacks-untitled && npm install
cp .env.example .env    # Add OPENAI_API_KEY + TINYFISH_API_KEY
docker compose up -d     # PostgreSQL + MinIO + Redis
npm run dev              # API :4005 + Web :5173
```

| URL | For |
|-----|-----|
| [localhost:5173](http://localhost:5173) | Careers homepage — browse jobs, company research |
| [localhost:5173/portal](http://localhost:5173/portal) | Candidate Portal — CV profile, gap analysis, learning resources |
| [localhost:5173/recruiter](http://localhost:5173/recruiter) | Recruiter Dashboard — manage jobs, evaluate candidates |

**Demo accounts** (password: `123456`):
- Recruiter: `hr@acme.example`
- Candidate: `toan@candidate.example`

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 11, TypeORM, BullMQ |
| Database | PostgreSQL 16, Redis 7 |
| Storage | MinIO (S3-compatible) |
| AI | OpenAI GPT-4o-mini |
| Web Intelligence | [TinyFish](https://tinyfish.ai) — SOTA web agents as API |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flows, database schema, API reference

## License

MIT
