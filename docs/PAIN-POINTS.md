# Pain Points & Solutions

How AI Recruitment Copilot solves real recruiter problems.

---

## Pain Point 1: CVs Are Self-Reported and Unverifiable

**The Problem:**
Candidates write whatever they want on their CV. There's no way to quickly verify if someone actually has 4 years of Node.js experience or if they just listed it.

**Our Solution:**
- **GitHub API integration** — Automatically fetch real repos, languages used, commit history, and contribution count. See what candidates actually build, not what they claim.
- **AI project analysis** — For the top 2-3 most active repos, we read the README, detect languages, count recent commits, and generate an AI assessment of code quality and tech depth.
- **LinkedIn enrichment** — Crawl public LinkedIn profile for work history, skills endorsements, recommendations from colleagues.
- **Work verification** — TinyFish visits company websites to check if the candidate's claimed employer exists and if there's any mention of the role.

**Result:** Recruiter sees verified signals alongside CV claims. Score reflects real evidence, not just self-reported text.

---

## Pain Point 2: Screening Is Time-Consuming and Subjective

**The Problem:**
Recruiters spend hours reading CVs, opening GitHub profiles, checking LinkedIn — all manually. Each recruiter evaluates differently, leading to inconsistent decisions.

**Our Solution:**
- **AI-powered scoring** — GPT-4o-mini evaluates every candidate against job requirements using a consistent framework. Returns a score (0-100), strengths, gaps, and a detailed explanation.
- **Automated pipeline** — Upload a CV → system automatically parses, enriches, and scores. No manual work needed.
- **Screening criteria** — Recruiters add private notes (e.g., "prefer fintech experience", "red flag: job hopping") that the AI uses for scoring but candidates never see.
- **Structured output** — Instead of reading a 3-page CV, recruiters see: skills list, experience timeline, match score, strengths/gaps.

**Result:** Minutes instead of hours per candidate. Consistent, explainable scoring across all applications.

---

## Pain Point 3: Important Signals Are Hidden

**The Problem:**
A candidate's real technical ability is shown in their GitHub repos, open source contributions, blog posts, and deployed projects — not in a bullet-pointed CV. But recruiters don't have time to investigate all these sources.

**Our Solution:**
- **Automatic link extraction** — AI reads the CV PDF and detects GitHub, LinkedIn, portfolio, and blog URLs.
- **GitHub deep analysis** — Not just "has a GitHub account" but: top languages, active repos with READMEs, commit frequency, project descriptions.
- **Extended enrichment** (on-demand):
  - **Portfolio analysis** — Visit personal website, assess design quality, detect tech stack
  - **Live project check** — Visit deployed apps, verify they work, assess UI quality
  - **Blog analysis** — Count posts, identify topics, assess writing quality
  - **Stack Overflow** — Check reputation, badges, top tags
- **All data feeds into scoring** — The AI considers everything when generating the match score.

**Result:** Every publicly available signal about a candidate is surfaced automatically.

---

## Pain Point 4: No Explanation Behind Hiring Decisions

**The Problem:**
Traditional screening produces a yes/no decision with no rationale. When asked "why did you reject this candidate?", recruiters struggle to articulate specific reasons.

**Our Solution:**
- **Explainable scores** — Every score comes with:
  - A multi-paragraph explanation of why the candidate fits or doesn't
  - Specific strengths (evidence-based)
  - Specific gaps (what's missing vs requirements)
  - Recommendation level: strong match, good match, partial match, weak match
- **Data source badges** — The score page shows exactly what data was used: "Based on: CV, AI-parsed skills, GitHub profile, LinkedIn profile"
- **Screening criteria transparency** — The internal criteria that influenced the score are visible to the recruiter.

**Result:** Every hiring decision has a documented, evidence-based rationale.

---

## Pain Point 5: Candidate Experience Is Poor

**The Problem:**
Candidates apply and hear nothing back. They don't know what jobs are available or whether their application was received.

**Our Solution:**
- **Public careers portal** (`/careers`) — Candidates browse all active jobs with rich markdown descriptions, requirements, and company info. Infinite scroll, no login needed.
- **Simple application flow** — Enter name + email + upload PDF. Confirmation message immediately.
- **Job descriptions with markdown** — Proper formatting with sections, tech stack tables, benefits. Not a plain text wall.
- **Contact info captured** — Candidate's email is stored for future communication.

**Result:** Professional candidate experience with transparent job listings and immediate feedback.

---

## Pain Point 6: Recruiter Bias

**The Problem:**
Unconscious bias in manual screening — name, university, photo, age can influence decisions instead of actual qualifications.

**Our Solution:**
- **Evidence-based scoring** — AI evaluates based on: skills match, experience relevance, GitHub activity, project quality. Not on demographics.
- **Structured data** — Parsed CV presents skills, experience, and education in a uniform format regardless of CV design/layout.
- **Screening criteria** — Forces recruiters to articulate what matters upfront ("3+ years Node.js, fintech experience") rather than making gut decisions.

**Result:** Evaluation focuses on what candidates can do, not who they are.

---

## Pain Point 7: Multi-Recruiter Coordination

**The Problem:**
When multiple recruiters work on hiring, there's no shared view. Candidates get evaluated differently, duplicated, or lost.

**Our Solution:**
- **Company-scoped data** — All recruiters in a company see the same jobs and candidates.
- **Centralized dashboard** — One place to see all candidates, their scores, and processing status.
- **Persistent data** — All parsed CV data, enrichment results, and scores are saved permanently. Any recruiter can review at any time.

**Result:** Single source of truth for all hiring activity within a company.
