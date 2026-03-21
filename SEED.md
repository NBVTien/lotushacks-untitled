# Seed Data

Database seeds automatically on first API start when no companies exist. To re-seed, drop all tables and restart:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d recruitment \
  -c "DROP TABLE IF EXISTS candidates, jobs, users, companies CASCADE;"
npm run dev:api
```

## Demo Accounts

All passwords: `123456`

| Email | Name | Company |
|-------|------|---------|
| `hr@acme.example` | Alice Recruiter | Acme Corp |
| `hr@moonlight.example` | Bob Recruiter | Moonlight Labs |
| `hr@nova.example` | Charlie Recruiter | Nova Systems |

## Companies

### Acme Corp
> Leading software company specializing in fintech and e-commerce solutions across Southeast Asia.

### Moonlight Labs
> AI-first startup building intelligent automation tools for enterprises.

### Nova Systems
> International software consulting firm with offices in 12 countries.

## Jobs (8 total)

### Acme Corp (3 jobs)

#### 1. Senior Backend Engineer (Node.js)
- **Stack:** Node.js 20+, TypeScript, PostgreSQL, Redis, Kafka, Kubernetes
- **Requirements:** 4+ years backend, PostgreSQL optimization, microservices, Docker/K8s
- **Screening Criteria:** Prefer fintech experience, open source contributions, HCMC-based. Red flags: no GitHub, job hopping < 1 year, only frontend claiming fullstack.

#### 2. Frontend Developer (React)
- **Stack:** React 19, Next.js 15, Tailwind CSS 4, Radix UI, Vitest, Playwright
- **Requirements:** 2+ years React/TypeScript, Tailwind, Next.js, web performance
- **Screening Criteria:** Must have portfolio/live projects, clean component architecture on GitHub, accessibility knowledge. Disqualify if only jQuery or no TypeScript.

#### 3. DevOps Engineer
- **Stack:** AWS (EKS, RDS, S3), Kubernetes, Terraform, GitHub Actions, Prometheus, Grafana
- **Requirements:** 3+ years DevOps/SRE, AWS, K8s, Terraform, CI/CD, monitoring
- **Screening Criteria:** None

### Moonlight Labs (2 jobs)

#### 4. Machine Learning Engineer
- **Stack:** PyTorch, Hugging Face, OpenAI/Anthropic APIs, FastAPI, AWS SageMaker, DVC
- **Requirements:** 3+ years ML, Python/PyTorch, NLP or CV, LLMs, production deployment
- **Screening Criteria:** Published papers or notable OSS ML projects, Kaggle medals, production ML at scale. Avoid pure data analysts, candidates who only list "ChatGPT" as AI experience.

#### 5. Full-Stack Developer (Python + React)
- **Stack:** FastAPI, async Python, React, TypeScript, Tailwind, WebSockets
- **Requirements:** 2+ years fullstack, Python backend + React frontend, AI/ML API integration
- **Screening Criteria:** Must have both backend AND frontend code on GitHub, shipped a product end-to-end, async Python preferred. Culture: self-starter, comfortable with ambiguity, good written communication.

### Nova Systems (3 jobs)

#### 6. Java Enterprise Developer
- **Stack:** Java 21, Kotlin, Spring Boot 3, Spring Cloud, Oracle, PostgreSQL, Kafka, ActiveMQ
- **Requirements:** 5+ years Java 17+, Spring Boot, JPA/Hibernate, enterprise integration patterns
- **Screening Criteria:** Must have banking/insurance/financial services experience, understand data privacy (PDPA, GDPR), distributed transactions. Do NOT accept junior-as-senior or only Android Java.

#### 7. QA Automation Engineer
- **Stack:** Playwright, Jest, k6, CI/CD
- **Requirements:** 3+ years QA automation, Playwright/Cypress, API testing, performance testing
- **Screening Criteria:** None

#### 8. Mobile Developer (React Native)
- **Stack:** React Native, Redux/MobX, REST/GraphQL, offline-first
- **Requirements:** 3+ years React Native, published apps on both stores, native modules, offline architecture
- **Screening Criteria:** Must verify actual published apps on stores, GitHub repos with RN code. Preferred: CodePush/OTA, native build pipelines (Fastlane), performance optimization.

## Screening Criteria Summary

6 out of 8 jobs have screening criteria. These are **internal only** — candidates never see them. The AI scoring engine uses them as additional filtering signals when evaluating candidate-job fit.

Jobs without screening criteria: DevOps Engineer, QA Automation Engineer.
