# AI Recruitment Copilot (Beyond CV)

## Problem

Recruiters today rely heavily on CVs to evaluate candidates. However:

- CVs are self-reported and often lack verification
- Important signals like real projects, coding activity, and actual experience are missing
- Screening candidates is time-consuming and subjective
- Recruiters struggle to quickly identify high-quality candidates

Key insight:
CV shows what candidates say, but not what they actually do.

---

## User Story

As a recruiter,
I want to evaluate candidates beyond their CV,
so that I can quickly and confidently shortlist the right candidates based on real evidence.

---

## Pains Resolved

- Reduce time spent on manual CV screening
- Provide verified signals from GitHub and LinkedIn instead of relying only on CV
- Deliver structured insights instead of raw text
- Generate explainable matching scores instead of guesswork
- Reduce bias by focusing on actual work and public contributions

---

## How It Works (Flow)

1. Create Job Description
   Recruiter inputs job requirements (e.g. Backend Node.js Engineer)

2. Upload Candidate CV (PDF)
   System extracts raw text from the CV

3. Extract External Links
   Detect GitHub, LinkedIn, or portfolio links inside the CV

4. Enrich Candidate Profile (via TinyFish)
   Crawl public data from detected links and extract:
   - Tech stack
   - Projects and repositories
   - Experience signals

5. Merge Data
   Combine CV data and external signals into a unified candidate profile

6. Generate Matching Score
   Compare candidate profile with job requirements and output:
   - Overall match score
   - Detailed explanation

7. Display Results (Dashboard)
   Recruiter can view:
   - Candidate profile
   - Skills (from CV and real-world sources)
   - Match score
   - Explanation

---

## MVP Scope (Hackathon POC)

Included:

- Create a simple Job Description (text input)
- Upload CV (PDF) and extract content
- Extract GitHub and LinkedIn links from CV
- Integrate TinyFish to fetch public candidate data
- Generate:
  - Matching score
  - Explanation (why candidate fits or not)
- Simple dashboard:
  - List candidates
  - View detailed result

Excluded:

- AI interview chatbot
- Complex workflow automation
- Multi-user system or authentication
- Advanced analytics

---

## Value Proposition

We help recruiters go beyond CVs by analyzing real-world candidate signals from public data, enabling faster and more reliable hiring decisions.

---

## Key Differentiator

- Not just CV parsing
- Evidence-based evaluation using:
  - GitHub activity
  - Real projects
  - Public professional profiles

---

## One-line Summary

Upload a CV, enrich it with real-world data, and get an explainable hiring decision.
