import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { CompanyEntity, UserEntity, JobEntity, CandidateEntity } from '../database'

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name)

  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>
  ) {}

  async onModuleInit() {
    const count = await this.companyRepo.count()
    if (count > 0) {
      this.logger.log('Seed data already exists, skipping')
      return
    }

    this.logger.log('Seeding database...')
    await this.seed()
    this.logger.log('Seed complete')
  }

  private async seed() {
    const techCorp = await this.companyRepo.save(
      this.companyRepo.create({
        name: 'Acme Corp',
        description:
          'Leading software company specializing in fintech and e-commerce solutions across Southeast Asia.',
      })
    )

    const startupAI = await this.companyRepo.save(
      this.companyRepo.create({
        name: 'Moonlight Labs',
        description: 'AI-first startup building intelligent automation tools for enterprises.',
      })
    )

    const globalSoft = await this.companyRepo.save(
      this.companyRepo.create({
        name: 'Nova Systems',
        description: 'International software consulting firm with offices in 12 countries.',
      })
    )

    const hashedPassword = await bcrypt.hash('123456', 10)

    await this.userRepo.save([
      this.userRepo.create({
        email: 'hr@acme.example',
        password: hashedPassword,
        name: 'Alice Recruiter',
        role: 'recruiter',
        companyId: techCorp.id,
      }),
      this.userRepo.create({
        email: 'hr@moonlight.example',
        password: hashedPassword,
        name: 'Bob Recruiter',
        role: 'recruiter',
        companyId: startupAI.id,
      }),
      this.userRepo.create({
        email: 'hr@nova.example',
        password: hashedPassword,
        name: 'Charlie Recruiter',
        role: 'recruiter',
        companyId: globalSoft.id,
      }),
      // Candidate user
      this.userRepo.create({
        email: 'toan@candidate.example',
        password: hashedPassword,
        name: 'Tran Thai Toan',
        role: 'candidate',
        companyId: null,
      }),
    ])

    // === TechCorp Jobs ===

    const seniorBackend = await this.jobRepo.save(
      this.jobRepo.create({
        companyId: techCorp.id,
        title: 'Senior Backend Engineer (Node.js)',
        description: `## About the Role

We are looking for a **Senior Backend Engineer** to join our **Payment Platform** team at Acme Corp. You will design and build high-throughput microservices that process **millions of transactions daily**.

## Tech Stack

- **Runtime:** Node.js 20+, TypeScript 5
- **Database:** PostgreSQL 16, Redis 7
- **Messaging:** Apache Kafka
- **Infrastructure:** Docker, Kubernetes (EKS), Terraform
- **Observability:** Datadog, OpenTelemetry

## What You'll Do

- Design and implement RESTful APIs and event-driven microservices
- Optimize database queries and ensure sub-100ms response times
- Collaborate with mobile and product teams on payment flows
- Participate in on-call rotation and incident response
- Mentor junior engineers and conduct code reviews

## Why Join Us?

- Work on systems processing **$50M+** in monthly transactions
- Competitive salary with equity options
- Flexible remote policy (2 days WFH per week)
- Annual learning budget of $2,000`,
        requirements: [
          '4+ years of backend development with Node.js/TypeScript',
          'Strong experience with PostgreSQL and query optimization',
          'Experience building RESTful APIs and microservices',
          'Familiarity with message queues (Kafka, RabbitMQ)',
          'Experience with Docker and Kubernetes',
          'Understanding of payment systems is a plus',
        ],
        screeningCriteria: `Prefer candidates with:
- Open source contributions on GitHub (shows initiative)
- Experience in fintech, payments, or banking domain
- Experience with event sourcing or CQRS patterns
- Based in Ho Chi Minh City or willing to relocate

Red flags:
- No GitHub profile or public portfolio
- Job hopping with less than 1 year per role
- Only frontend experience claiming fullstack
- Resume lists too many technologies without depth`,
      })
    )

    const frontendReact = await this.jobRepo.save(
      this.jobRepo.create({
        companyId: techCorp.id,
        title: 'Frontend Developer (React)',
        description: `## About the Role

Join our **e-commerce platform** team to build beautiful, performant user interfaces serving **2M+ monthly active users**.

## Tech Stack

- **Framework:** React 19, Next.js 15
- **Styling:** Tailwind CSS 4, Radix UI
- **State:** React Query, Zustand
- **Testing:** Vitest, Playwright
- **Build:** Vite, Turborepo

## What You'll Do

- Build responsive, accessible UI components
- Optimize Core Web Vitals and page load performance
- Integrate with headless CMS and product APIs
- Write unit and E2E tests for critical user flows
- Collaborate with designers on component library

## Perks

- Modern MacBook Pro provided
- Monthly team social budget
- Conference attendance support`,
        requirements: [
          '2+ years of React and TypeScript experience',
          'Proficiency in Tailwind CSS or modern CSS frameworks',
          'Experience with Next.js or SSR frameworks',
          'Understanding of web performance optimization',
          'Experience with React Query or similar data-fetching libraries',
          'Eye for design and attention to UI/UX',
        ],
        screeningCriteria: `Must-have signals:
- Portfolio or live deployed projects (shows craft)
- GitHub with React projects showing clean component architecture
- Understanding of accessibility (WCAG compliance)

Nice to have:
- Experience with design systems or component libraries
- Contributions to open-source UI libraries
- Animation/motion design skills (Framer Motion)

Disqualify if:
- Only jQuery or vanilla JS experience
- No understanding of TypeScript`,
      })
    )

    const devopsJob = await this.jobRepo.save(
      this.jobRepo.create({
        companyId: techCorp.id,
        title: 'DevOps Engineer',
        description: `## About the Role

We need a **DevOps Engineer** to manage and improve our cloud infrastructure on AWS. You will ensure **99.99% uptime** for our production services.

## Responsibilities

- Build and maintain CI/CD pipelines (GitHub Actions)
- Manage Kubernetes clusters (EKS) across staging and production
- Implement Infrastructure as Code with Terraform
- Set up monitoring, alerting, and incident response
- Improve developer experience and deployment workflows

## Required Skills

Strong hands-on experience with AWS, Kubernetes, and Terraform. Comfortable with scripting in Bash and Python.`,
        requirements: [
          '3+ years of DevOps/SRE experience',
          'Strong AWS experience (EKS, RDS, S3, CloudFront)',
          'Kubernetes administration and Helm charts',
          'Infrastructure as Code with Terraform',
          'CI/CD pipeline design (GitHub Actions)',
          'Monitoring with Prometheus and Grafana',
        ],
        screeningCriteria: null,
      })
    )

    // === Moonlight Labs Jobs ===

    const mlEngineer = await this.jobRepo.save(
      this.jobRepo.create({
        companyId: startupAI.id,
        title: 'Machine Learning Engineer',
        description: `## About Moonlight Labs

We're building the next generation of **intelligent document processing**. Our platform uses cutting-edge AI to extract, understand, and act on information from business documents.

## The Role

As an **ML Engineer**, you will:

1. **Build ML pipelines** — design, train, and deploy NLP and vision models
2. **Work with LLMs** — integrate GPT-4, Claude, and fine-tuned models
3. **Ship to production** — deploy models on AWS SageMaker with real-time inference
4. **Iterate fast** — run experiments, evaluate metrics, and improve accuracy

## Tech Stack

| Area | Tools |
|------|-------|
| ML | PyTorch, Hugging Face, scikit-learn |
| LLMs | OpenAI API, Anthropic API, LangChain |
| Backend | FastAPI, Python 3.12 |
| Infra | AWS SageMaker, Docker, GitHub Actions |
| Data | PostgreSQL, S3, DVC |

## Compensation

- Competitive salary + **0.5-1.5% equity**
- $3,000/year learning & conference budget
- Remote-friendly with quarterly team offsites`,
        requirements: [
          '3+ years of ML engineering experience',
          'Strong Python and PyTorch/TensorFlow skills',
          'Experience with NLP and/or Computer Vision',
          'Familiarity with LLMs and prompt engineering',
          'Experience deploying ML models to production',
          'Published research or open-source contributions is a plus',
        ],
        screeningCriteria: `Strong signals:
- Published papers or notable open-source ML projects
- Kaggle competitions (top 10% or medals)
- Experience with production ML at scale (not just notebooks)
- Strong understanding of evaluation metrics and experiment tracking

Screening questions to consider:
- Can they explain the difference between fine-tuning and RAG?
- Do they have experience with model serving and latency optimization?
- Have they worked with real-world messy data, not just clean datasets?

Avoid:
- Pure data analysts without engineering skills
- Candidates who only list "ChatGPT" as AI experience`,
      })
    )

    await this.jobRepo.save(
      this.jobRepo.create({
        companyId: startupAI.id,
        title: 'Full-Stack Developer (Python + React)',
        description: `## About the Role

We're looking for a **Full-Stack Developer** to build our AI-powered SaaS platform. You'll work across the entire stack — from FastAPI backends to React dashboards.

## What You'll Build

- **Backend APIs** with FastAPI and async Python
- **Frontend dashboards** with React, TypeScript, and Tailwind
- **AI integrations** — connect LLM outputs to user-facing features
- **Real-time features** using WebSockets
- **Data visualizations** for document processing analytics

## Culture

We're a small team (12 people) that ships fast. You'll have direct impact on product decisions and architecture choices. We value pragmatism over perfection.`,
        requirements: [
          '2+ years of full-stack development',
          'Backend: Python (FastAPI or Django), PostgreSQL',
          'Frontend: React, TypeScript, Tailwind CSS',
          'Experience integrating AI/ML APIs',
          'Understanding of WebSocket and real-time features',
          'Startup mindset — comfortable wearing multiple hats',
        ],
        screeningCriteria: `Key criteria:
- Must have both backend AND frontend code on GitHub
- Preference for candidates who have built and shipped a product end-to-end
- Experience with async Python (asyncio, FastAPI) strongly preferred
- Bonus: experience with LLM integration (not just calling APIs)

Culture fit:
- Self-starter who doesn't need hand-holding
- Comfortable with ambiguity and changing requirements
- Good written communication (we're async-first)`,
      })
    )

    // === GlobalSoft Jobs ===

    await this.jobRepo.save(
      this.jobRepo.create({
        companyId: globalSoft.id,
        title: 'Java Enterprise Developer',
        description: `## About the Role

Join our enterprise team building **mission-critical systems** for banking and insurance clients. You'll develop microservices using Spring Boot and integrate with large-scale enterprise platforms.

## Responsibilities

- Develop and maintain Java microservices with Spring Boot
- Design database schemas and optimize SQL queries
- Integrate with legacy systems via enterprise messaging
- Write comprehensive unit and integration tests
- Participate in architectural design reviews

## Tech Stack

- **Language:** Java 21, Kotlin
- **Framework:** Spring Boot 3, Spring Cloud
- **Database:** Oracle, PostgreSQL, Redis
- **Messaging:** Apache Kafka, ActiveMQ
- **Build:** Maven, Gradle
- **Testing:** JUnit 5, Mockito, Testcontainers`,
        requirements: [
          '5+ years of Java development (Java 17+)',
          'Strong Spring Boot and Spring Cloud experience',
          'Experience with relational databases and JPA/Hibernate',
          'Knowledge of enterprise integration patterns',
          'Experience with Apache Kafka or ActiveMQ',
          'Understanding of SOLID principles and clean architecture',
        ],
        screeningCriteria: `Enterprise readiness check:
- Must have experience with banking, insurance, or financial services
- Understanding of data privacy regulations (PDPA, GDPR)
- Experience with distributed transactions and saga patterns
- Bonus: Oracle Certified Professional or Spring certification

Do NOT accept:
- Junior candidates positioned as senior
- Only Android/mobile Java experience
- No experience with enterprise-scale systems`,
      })
    )

    await this.jobRepo.save(
      this.jobRepo.create({
        companyId: globalSoft.id,
        title: 'QA Automation Engineer',
        description: `## About the Role

Build and maintain our **test automation framework** for enterprise products. You will ensure quality across APIs, web UIs, and performance.

## What You'll Do

- Design and implement E2E test suites with **Playwright**
- Build API test automation with custom frameworks
- Run performance tests with **k6** and analyze results
- Integrate tests into CI/CD pipelines
- Collaborate with developers on testability improvements

## Required Skills

Strong programming skills in TypeScript or Python. Experience with modern testing tools and CI/CD integration.`,
        requirements: [
          '3+ years of QA automation experience',
          'Strong experience with Playwright or Cypress',
          'API testing with Postman/Newman or similar',
          'Performance testing with k6, JMeter, or Gatling',
          'Programming skills in TypeScript or Python',
          'CI/CD integration for automated tests',
        ],
        screeningCriteria: null,
      })
    )

    await this.jobRepo.save(
      this.jobRepo.create({
        companyId: globalSoft.id,
        title: 'Mobile Developer (React Native)',
        description: `## About the Role

Build **cross-platform mobile applications** for our global clients. Our apps serve **500K+ users** across iOS and Android.

## What You'll Build

- Production-grade mobile apps using React Native
- Offline-first features with local storage and sync
- Push notifications, deep linking, and analytics
- Integration with REST and GraphQL APIs
- Native modules for platform-specific features

## Requirements

Proven track record of published apps on both App Store and Google Play. Experience with native iOS/Android development is a strong plus.`,
        requirements: [
          '3+ years of React Native development',
          'Published apps on both App Store and Google Play',
          'Experience with native modules (iOS/Android)',
          'State management with Redux or MobX',
          'Offline-first architecture and local storage',
          'Push notifications, deep linking, and analytics',
        ],
        screeningCriteria: `Must verify:
- Links to actual published apps on stores
- GitHub repos with React Native code (not just tutorials)

Preferred:
- Experience with CodePush or OTA updates
- Knowledge of native build pipelines (Fastlane, Xcode, Gradle)
- Performance optimization experience (FPS, memory)`,
      })
    )

    // === Bulk jobs for infinite scroll demo ===
    await this.seedBulkJobs([techCorp.id, startupAI.id, globalSoft.id])

    // === Seed candidates for key jobs ===
    await this.seedCandidates(seniorBackend.id, frontendReact.id, devopsJob.id, mlEngineer.id)
  }

  private async seedCandidates(
    backendJobId: string,
    frontendJobId: string,
    devopsJobId: string,
    mlJobId: string
  ) {
    this.logger.log('Seeding candidates...')

    // Candidate 1 — Strong match for Senior Backend Engineer (score: 91)
    await this.candidateRepo.save(
      this.candidateRepo.create({
        jobId: backendJobId,
        name: 'Nguyen Minh Tuan',
        email: 'tuan.nguyen@gmail.com',
        phone: '+84 912 345 678',
        cvUrl: 'seed/tuan-nguyen-cv.pdf',
        cvText: `NGUYEN MINH TUAN
Senior Backend Engineer | Ho Chi Minh City, Vietnam
tuan.nguyen@gmail.com | github.com/tuannguyen-dev | linkedin.com/in/tuannguyen-dev

PROFESSIONAL SUMMARY
Senior backend engineer with 6+ years of experience building high-throughput distributed systems in Node.js and TypeScript. Specialized in payment processing, event-driven architectures, and database optimization. Led the migration of a monolithic payment gateway to microservices handling 2M+ daily transactions at VNPay.

EXPERIENCE
Senior Software Engineer — VNPay (2021 - Present)
- Architected and built payment processing microservices handling $30M+ monthly transaction volume
- Reduced API latency from 450ms to 65ms through PostgreSQL query optimization and Redis caching
- Designed event-driven architecture using Apache Kafka for real-time transaction reconciliation
- Led team of 4 engineers; implemented CQRS pattern for payment ledger system
- Achieved 99.97% uptime across all payment services over 18 months

Backend Developer — Tiki Corporation (2019 - 2021)
- Built order management microservices serving 500K+ daily orders during flash sales
- Implemented distributed caching layer reducing database load by 60%
- Developed webhook system for merchant notifications with guaranteed delivery
- Contributed to internal Node.js framework used by 12 engineering teams

Junior Developer — FPT Software (2017 - 2019)
- Developed RESTful APIs for banking client using Node.js and Express
- Built automated testing pipeline reducing QA cycle from 3 days to 4 hours
- Maintained PostgreSQL databases with 500M+ records

EDUCATION
B.S. Computer Science — Ho Chi Minh City University of Technology (2017)

SKILLS
Languages: TypeScript, JavaScript, Python, SQL
Frameworks: NestJS, Express, Fastify
Databases: PostgreSQL, Redis, MongoDB
Infrastructure: Docker, Kubernetes, Terraform, AWS (EKS, RDS, SQS)
Messaging: Apache Kafka, RabbitMQ
Observability: Datadog, Prometheus, Grafana, OpenTelemetry`,
        status: 'completed',
        links: {
          github: 'https://github.com/tuannguyen-dev',
          linkedin: 'https://linkedin.com/in/tuannguyen-dev',
          portfolio: [],
          classified: [],
        },
        parsedCV: {
          summary:
            'Senior backend engineer with 6+ years building high-throughput distributed systems in Node.js and TypeScript. Specialized in payment processing and event-driven architectures.',
          skills: [
            'TypeScript',
            'Node.js',
            'NestJS',
            'PostgreSQL',
            'Redis',
            'Kafka',
            'Docker',
            'Kubernetes',
            'Terraform',
            'AWS',
          ],
          experience: [
            {
              title: 'Senior Software Engineer',
              company: 'VNPay',
              duration: '2021 - Present',
              description:
                'Architected payment processing microservices handling $30M+ monthly. Led team of 4 engineers.',
            },
            {
              title: 'Backend Developer',
              company: 'Tiki Corporation',
              duration: '2019 - 2021',
              description:
                'Built order management microservices serving 500K+ daily orders during flash sales.',
            },
            {
              title: 'Junior Developer',
              company: 'FPT Software',
              duration: '2017 - 2019',
              description:
                'Developed RESTful APIs for banking client using Node.js and Express.',
            },
          ],
          education: [
            {
              degree: 'B.S. Computer Science',
              school: 'Ho Chi Minh City University of Technology',
              year: '2017',
            },
          ],
        },
        enrichment: {
          github: {
            username: 'tuannguyen-dev',
            bio: 'Senior Backend Engineer | Node.js, TypeScript, PostgreSQL | Building payment systems at scale',
            topLanguages: ['TypeScript', 'JavaScript', 'Python', 'Go'],
            repositories: [
              {
                name: 'nest-kafka-microservices',
                description:
                  'Production-ready NestJS microservices template with Kafka, CQRS, and event sourcing',
                language: 'TypeScript',
                stars: 342,
              },
              {
                name: 'pg-query-optimizer',
                description: 'PostgreSQL query analysis and optimization toolkit for Node.js',
                language: 'TypeScript',
                stars: 128,
              },
              {
                name: 'distributed-lock-redis',
                description: 'Robust distributed locking library using Redis with fencing tokens',
                language: 'TypeScript',
                stars: 89,
              },
              {
                name: 'payment-gateway-sdk',
                description: 'TypeScript SDK for Vietnamese payment gateways (VNPay, MoMo, ZaloPay)',
                language: 'TypeScript',
                stars: 215,
              },
            ],
            totalStars: 774,
            totalContributions: 1847,
            raw: 'GitHub profile data fetched via API',
          },
          linkedin: null,
        },
        matchResult: {
          overallScore: 91,
          explanation:
            'Nguyen Minh Tuan is an exceptional match for the Senior Backend Engineer position. With 6+ years of Node.js/TypeScript experience focused specifically on payment processing systems, he directly aligns with the core requirements. His track record at VNPay — architecting microservices handling $30M+ monthly transactions and reducing API latency to 65ms — demonstrates exactly the scale and performance optimization skills needed. His experience with PostgreSQL, Kafka, Docker, Kubernetes, and Terraform covers the entire tech stack. His GitHub profile shows high-quality open source work with 774 total stars, including a NestJS Kafka microservices template that directly relates to this role.',
          strengths: [
            'Direct payment system experience at VNPay with $30M+ monthly transaction volume',
            'Proven PostgreSQL optimization skills — reduced latency from 450ms to 65ms',
            'Strong Kafka and event-driven architecture experience matching job requirements',
            'Active open source contributor with 774 GitHub stars and relevant projects',
            'Team leadership experience mentoring 4 engineers and conducting code reviews',
            'Based in Ho Chi Minh City, matching the preferred location',
          ],
          gaps: [
            'No explicit mention of event sourcing pattern experience (though CQRS is mentioned)',
          ],
          recommendation: 'strong_match',
          improvementTips: [
            'Consider highlighting any event sourcing implementations in the interview',
            'Ask about experience with OpenTelemetry and distributed tracing in production',
          ],
        },
        enrichmentProgress: {},
        progressLogs: [
          'CV uploaded successfully',
          'PDF parsed — extracted 1,247 words',
          'GitHub profile enriched — 4 repositories found, 774 total stars',
          'Match scoring complete — 91/100 (strong_match)',
        ],
        retryCount: 0,
      })
    )

    // Candidate 2 — Good match for Senior Backend Engineer (score: 73)
    await this.candidateRepo.save(
      this.candidateRepo.create({
        jobId: backendJobId,
        name: 'Tran Hoang Khoi',
        email: 'khoi.tran@outlook.com',
        phone: '+84 903 456 789',
        cvUrl: 'seed/khoi-tran-cv.pdf',
        cvText: `TRAN HOANG KHOI
Full-Stack Developer | Da Nang, Vietnam
khoi.tran@outlook.com | github.com/khoitran-fs | linkedin.com/in/khoitrandev

PROFESSIONAL SUMMARY
Full-stack developer with 4 years of experience building web applications with Node.js and React. Strong database skills with PostgreSQL and MongoDB. Transitioning toward backend-focused roles with growing interest in distributed systems and microservices.

EXPERIENCE
Full-Stack Developer — Axon Active Vietnam (2022 - Present)
- Built RESTful APIs using NestJS and TypeScript for Swiss healthcare clients
- Implemented real-time notification system using WebSockets and Redis pub/sub
- Designed database schemas for multi-tenant SaaS application serving 50K users
- Wrote integration tests achieving 85% code coverage across backend services
- Optimized slow PostgreSQL queries reducing p95 response time by 40%

Web Developer —Ến Solutions (2020 - 2022)
- Developed full-stack features for e-commerce platform using Express.js and React
- Built admin dashboard with data visualization using Recharts and D3.js
- Implemented payment integration with Stripe and local Vietnamese gateways
- Managed Docker-based development environment for team of 6

EDUCATION
B.S. Information Technology — Da Nang University of Science and Technology (2020)

SKILLS
Languages: TypeScript, JavaScript, Python
Frontend: React, Next.js, Tailwind CSS
Backend: NestJS, Express, Fastify
Databases: PostgreSQL, MongoDB, Redis
Tools: Docker, GitHub Actions, Nginx`,
        status: 'completed',
        links: {
          github: 'https://github.com/khoitran-fs',
          linkedin: 'https://linkedin.com/in/khoitrandev',
          portfolio: ['https://khoitran.dev'],
          classified: [
            {
              url: 'https://khoitran.dev',
              kind: 'portfolio' as const,
              label: 'Personal portfolio',
            },
          ],
        },
        parsedCV: {
          summary:
            'Full-stack developer with 4 years of experience building web applications with Node.js and React. Strong PostgreSQL skills.',
          skills: [
            'TypeScript',
            'Node.js',
            'NestJS',
            'React',
            'PostgreSQL',
            'MongoDB',
            'Redis',
            'Docker',
          ],
          experience: [
            {
              title: 'Full-Stack Developer',
              company: 'Axon Active Vietnam',
              duration: '2022 - Present',
              description:
                'Built RESTful APIs using NestJS for Swiss healthcare clients. Multi-tenant SaaS serving 50K users.',
            },
            {
              title: 'Web Developer',
              company: 'Ến Solutions',
              duration: '2020 - 2022',
              description:
                'Full-stack development for e-commerce platform using Express.js and React.',
            },
          ],
          education: [
            {
              degree: 'B.S. Information Technology',
              school: 'Da Nang University of Science and Technology',
              year: '2020',
            },
          ],
        },
        enrichment: {
          github: {
            username: 'khoitran-fs',
            bio: 'Full-stack developer | NestJS + React | Da Nang, Vietnam',
            topLanguages: ['TypeScript', 'JavaScript', 'Python'],
            repositories: [
              {
                name: 'nestjs-boilerplate',
                description: 'Production-ready NestJS boilerplate with auth, RBAC, and Swagger docs',
                language: 'TypeScript',
                stars: 45,
              },
              {
                name: 'react-admin-dashboard',
                description: 'Full-featured admin dashboard with React, Tailwind, and Recharts',
                language: 'TypeScript',
                stars: 32,
              },
            ],
            totalStars: 77,
            totalContributions: 623,
            raw: 'GitHub profile data fetched via API',
          },
          linkedin: null,
        },
        matchResult: {
          overallScore: 73,
          explanation:
            'Tran Hoang Khoi is a good match with solid Node.js/TypeScript fundamentals and growing backend expertise. His 4 years of experience meets the minimum requirement, and his NestJS work at Axon Active is directly relevant. He has PostgreSQL optimization experience and Docker skills. However, he lacks experience with message queues (Kafka/RabbitMQ), Kubernetes, and has no payment domain experience. His profile skews full-stack rather than backend-specialized, which is a minor concern for a senior backend role.',
          strengths: [
            'Solid NestJS and TypeScript experience directly applicable to the role',
            'PostgreSQL query optimization experience with measurable results (40% p95 improvement)',
            'Experience with real-time systems using WebSockets and Redis pub/sub',
            'Some payment integration experience (Stripe, Vietnamese gateways)',
            'Good testing practices with 85% code coverage',
          ],
          gaps: [
            'No experience with message queues like Kafka or RabbitMQ',
            'No Kubernetes experience — only Docker-based workflows',
            'Limited distributed systems experience at scale',
            'Based in Da Nang, not Ho Chi Minh City (remote may be needed)',
            'More full-stack oriented than backend-specialized',
          ],
          recommendation: 'good_match',
          improvementTips: [
            'Probe depth of payment integration experience in the interview',
            'Assess willingness to relocate to HCM or work in a hybrid arrangement',
            'Test understanding of distributed systems concepts (CAP theorem, eventual consistency)',
            'Evaluate Kafka/messaging knowledge — could be learned on the job',
          ],
        },
        enrichmentProgress: {},
        progressLogs: [
          'CV uploaded successfully',
          'PDF parsed — extracted 892 words',
          'GitHub profile enriched — 2 repositories found, 77 total stars',
          'Match scoring complete — 73/100 (good_match)',
        ],
        retryCount: 0,
      })
    )

    // Candidate 3 — Good match for Frontend Developer (score: 78)
    await this.candidateRepo.save(
      this.candidateRepo.create({
        jobId: frontendJobId,
        name: 'Le Thi Mai Anh',
        email: 'maianh.le@gmail.com',
        phone: '+84 908 765 432',
        cvUrl: 'seed/maianh-le-cv.pdf',
        cvText: `LE THI MAI ANH
Frontend Developer | Ho Chi Minh City, Vietnam
maianh.le@gmail.com | github.com/maianhle | linkedin.com/in/maianhle-dev

PROFESSIONAL SUMMARY
Frontend developer with 3 years of experience specializing in React and modern CSS. Passionate about building accessible, performant user interfaces with excellent attention to design detail. Experience with design systems, component libraries, and performance optimization.

EXPERIENCE
Frontend Developer — Shopee (2022 - Present)
- Built reusable component library used across 8 product teams with Storybook documentation
- Implemented lazy loading and code splitting reducing initial bundle size by 45%
- Improved Largest Contentful Paint from 3.2s to 1.4s on product listing pages
- Collaborated with UX team to implement WCAG AA compliance across checkout flow
- Developed real-time inventory status using Server-Sent Events and React Query

Junior Frontend Developer — NashTech Vietnam (2021 - 2022)
- Built customer-facing dashboards using React, TypeScript, and Material UI
- Implemented responsive designs achieving 98+ Lighthouse mobile scores
- Created animated product showcase pages using Framer Motion
- Wrote unit tests with React Testing Library achieving 80% component coverage

EDUCATION
B.S. Software Engineering — University of Science, Ho Chi Minh City (2021)

SKILLS
Languages: TypeScript, JavaScript, HTML, CSS
Frameworks: React 18, Next.js 14, Vite
Styling: Tailwind CSS, CSS Modules, Styled Components, Framer Motion
State: React Query, Zustand, Redux Toolkit
Testing: Vitest, React Testing Library, Playwright
Tools: Figma, Storybook, Chromatic`,
        status: 'completed',
        links: {
          github: 'https://github.com/maianhle',
          linkedin: 'https://linkedin.com/in/maianhle-dev',
          portfolio: ['https://maianhle.dev'],
          classified: [
            {
              url: 'https://maianhle.dev',
              kind: 'portfolio' as const,
              label: 'Personal portfolio with project showcases',
            },
          ],
        },
        parsedCV: {
          summary:
            'Frontend developer with 3 years specializing in React and modern CSS. Focus on accessibility, performance, and design systems.',
          skills: [
            'React',
            'TypeScript',
            'Next.js',
            'Tailwind CSS',
            'React Query',
            'Zustand',
            'Framer Motion',
            'Storybook',
            'Playwright',
          ],
          experience: [
            {
              title: 'Frontend Developer',
              company: 'Shopee',
              duration: '2022 - Present',
              description:
                'Built reusable component library. Improved LCP from 3.2s to 1.4s. WCAG AA compliance.',
            },
            {
              title: 'Junior Frontend Developer',
              company: 'NashTech Vietnam',
              duration: '2021 - 2022',
              description:
                'Built dashboards with React and TypeScript. Achieved 98+ Lighthouse mobile scores.',
            },
          ],
          education: [
            {
              degree: 'B.S. Software Engineering',
              school: 'University of Science, Ho Chi Minh City',
              year: '2021',
            },
          ],
        },
        enrichment: {
          github: {
            username: 'maianhle',
            bio: 'Frontend Developer @Shopee | React, TypeScript, Tailwind | Building beautiful UIs',
            topLanguages: ['TypeScript', 'JavaScript', 'CSS'],
            repositories: [
              {
                name: 'react-component-kit',
                description:
                  'Accessible React component library built with Radix UI and Tailwind CSS',
                language: 'TypeScript',
                stars: 156,
              },
              {
                name: 'next-ecommerce-template',
                description: 'Production-ready Next.js e-commerce starter with Tailwind and Stripe',
                language: 'TypeScript',
                stars: 89,
              },
              {
                name: 'framer-motion-recipes',
                description: 'Collection of copy-paste animation patterns for React apps',
                language: 'TypeScript',
                stars: 234,
              },
            ],
            totalStars: 479,
            totalContributions: 956,
            raw: 'GitHub profile data fetched via API',
          },
          linkedin: null,
        },
        matchResult: {
          overallScore: 78,
          explanation:
            'Le Thi Mai Anh is a strong frontend developer with directly relevant experience at Shopee. Her 3 years of React and TypeScript experience, combined with Tailwind CSS proficiency, component library development, and Core Web Vitals optimization, align well with the role. Her work on accessibility (WCAG AA) and Framer Motion animations are notable bonuses. Her open source work (479 GitHub stars) demonstrates initiative and community engagement. The main gap is that she has used Next.js 14 but the role uses Next.js 15 and React 19 — though this is a minor version upgrade concern.',
          strengths: [
            'Strong React and TypeScript skills with 3 years of production experience at Shopee',
            'Tailwind CSS expertise with a published component library (156 stars)',
            'Proven Core Web Vitals optimization — reduced LCP from 3.2s to 1.4s',
            'WCAG AA accessibility compliance experience',
            'Framer Motion and animation skills with a popular open source project (234 stars)',
            'Testing experience with Vitest, React Testing Library, and Playwright',
          ],
          gaps: [
            'Experience with Next.js 14, not 15 — minor gap but worth noting',
            'No explicit Turborepo or monorepo experience mentioned',
            'Relatively early career — 3 years total may need mentorship for complex architecture decisions',
          ],
          recommendation: 'good_match',
          improvementTips: [
            'Ask about experience with large-scale design systems and cross-team collaboration',
            'Explore depth of React Query knowledge, especially optimistic updates and caching strategies',
            'Verify Playwright E2E testing experience is hands-on, not just unit testing',
          ],
        },
        enrichmentProgress: {},
        progressLogs: [
          'CV uploaded successfully',
          'PDF parsed — extracted 1,034 words',
          'GitHub profile enriched — 3 repositories found, 479 total stars',
          'Match scoring complete — 78/100 (good_match)',
        ],
        retryCount: 0,
      })
    )

    // Candidate 4 — Partial match for DevOps Engineer (score: 52)
    await this.candidateRepo.save(
      this.candidateRepo.create({
        jobId: devopsJobId,
        name: 'Pham Duc Hieu',
        email: 'hieu.pham@proton.me',
        phone: '+84 987 654 321',
        cvUrl: 'seed/hieu-pham-cv.pdf',
        cvText: `PHAM DUC HIEU
Systems Administrator | Hanoi, Vietnam
hieu.pham@proton.me | linkedin.com/in/hieuphamsys

PROFESSIONAL SUMMARY
Systems administrator with 5 years of experience managing Linux servers and on-premise infrastructure. Currently upskilling in cloud technologies and container orchestration. Strong scripting skills in Bash and Python with experience in monitoring and alerting.

EXPERIENCE
Senior Systems Administrator — Viettel IDC (2021 - Present)
- Manage 200+ Linux servers across 3 data centers with 99.95% uptime
- Implemented Ansible automation for server provisioning reducing setup time by 70%
- Built monitoring dashboards using Prometheus and Grafana for infrastructure health
- Configured Nginx load balancers handling 50K concurrent connections
- Led migration of legacy monitoring from Nagios to Prometheus stack

Systems Administrator — FPT Telecom (2019 - 2021)
- Managed CentOS and Ubuntu servers for internal development teams
- Wrote Bash scripts for log rotation, backup automation, and health checks
- Administered PostgreSQL and MySQL databases for internal applications
- Supported Docker containerization pilot project for development environments

CERTIFICATIONS
- AWS Solutions Architect Associate (2024)
- Red Hat Certified System Administrator (2021)
- Linux Professional Institute LPIC-1 (2019)

EDUCATION
B.S. Network Engineering — Hanoi University of Science and Technology (2019)

SKILLS
OS: CentOS, Ubuntu, Red Hat Enterprise Linux
Tools: Ansible, Docker, Prometheus, Grafana, Nginx, HAProxy
Scripting: Bash, Python
Cloud: AWS (EC2, S3, RDS) — learning
Networking: TCP/IP, DNS, VPN, Firewall (iptables)`,
        status: 'completed',
        links: {
          github: null,
          linkedin: 'https://linkedin.com/in/hieuphamsys',
          portfolio: [],
          classified: [],
        },
        parsedCV: {
          summary:
            'Systems administrator with 5 years managing Linux servers and on-premise infrastructure. Upskilling in cloud and containers.',
          skills: [
            'Linux',
            'Ansible',
            'Docker',
            'Prometheus',
            'Grafana',
            'Nginx',
            'Bash',
            'Python',
            'AWS',
          ],
          experience: [
            {
              title: 'Senior Systems Administrator',
              company: 'Viettel IDC',
              duration: '2021 - Present',
              description:
                'Manage 200+ Linux servers across 3 data centers. Built Prometheus/Grafana monitoring.',
            },
            {
              title: 'Systems Administrator',
              company: 'FPT Telecom',
              duration: '2019 - 2021',
              description:
                'Managed servers for internal teams. Docker containerization pilot project.',
            },
          ],
          education: [
            {
              degree: 'B.S. Network Engineering',
              school: 'Hanoi University of Science and Technology',
              year: '2019',
            },
          ],
        },
        enrichment: {
          github: null,
          linkedin: null,
        },
        matchResult: {
          overallScore: 52,
          explanation:
            'Pham Duc Hieu has strong foundational infrastructure skills but significant gaps in the modern DevOps toolchain required for this role. His 5 years of Linux administration and Prometheus/Grafana monitoring experience are relevant. However, he has minimal Kubernetes experience (the core requirement), no Terraform or Infrastructure-as-Code experience beyond Ansible, and only beginner-level AWS knowledge despite a recent certification. His background is primarily on-premise systems administration rather than cloud-native DevOps. He is clearly transitioning toward DevOps and shows initiative with the AWS certification, but would need significant ramp-up time.',
          strengths: [
            'Strong Linux server administration with 200+ server fleet management',
            'Prometheus and Grafana monitoring experience directly matches job requirements',
            'Automation mindset demonstrated through Ansible playbooks',
            'AWS Solutions Architect certification shows learning initiative',
            'Solid scripting skills in Bash and Python',
          ],
          gaps: [
            'No Kubernetes experience — the primary requirement for this role',
            'No Terraform or IaC experience beyond Ansible',
            'Limited AWS hands-on experience despite certification',
            'No CI/CD pipeline design experience (GitHub Actions)',
            'No GitHub profile — difficult to assess technical depth',
            'On-premise focused background vs. cloud-native requirements',
          ],
          recommendation: 'partial_match',
          improvementTips: [
            'If considering, plan a 3-6 month ramp-up period for Kubernetes and Terraform',
            'Test practical AWS and container knowledge beyond certification theory',
            'Assess appetite for CI/CD and GitOps workflows',
            'Consider for a junior DevOps role with mentorship rather than this senior position',
          ],
        },
        enrichmentProgress: {},
        progressLogs: [
          'CV uploaded successfully',
          'PDF parsed — extracted 876 words',
          'No GitHub profile found — skipping enrichment',
          'Match scoring complete — 52/100 (partial_match)',
        ],
        retryCount: 0,
      })
    )

    // Candidate 5 — Weak match for ML Engineer (score: 34)
    await this.candidateRepo.save(
      this.candidateRepo.create({
        jobId: mlJobId,
        name: 'Vo Thanh Dat',
        email: 'dat.vo@yahoo.com',
        phone: '+84 976 543 210',
        cvUrl: 'seed/dat-vo-cv.pdf',
        cvText: `VO THANH DAT
Data Analyst | Ho Chi Minh City, Vietnam
dat.vo@yahoo.com | linkedin.com/in/datvo-analyst

PROFESSIONAL SUMMARY
Data analyst with 2 years of experience creating reports, dashboards, and data visualizations. Proficient in SQL, Excel, and Power BI. Basic Python skills for data cleaning and automation. Interested in transitioning to machine learning and AI.

EXPERIENCE
Data Analyst — Masan Group (2023 - Present)
- Created weekly sales reports and KPI dashboards using Power BI for executive team
- Wrote complex SQL queries for data extraction from MySQL data warehouse
- Automated report generation with Python scripts saving 10 hours per week
- Performed A/B test analysis for marketing campaigns using basic statistical methods
- Collaborated with engineering team to define data requirements for new ETL pipelines

Junior Data Analyst — PwC Vietnam (2022 - 2023)
- Assisted audit team with data extraction and validation from client ERP systems
- Built Excel models for financial forecasting and variance analysis
- Learned basic Python (pandas, matplotlib) for data cleaning tasks
- Created Tableau dashboards for client engagement presentations

EDUCATION
B.S. Business Administration — Foreign Trade University, HCMC (2022)
Online Courses: Andrew Ng's Machine Learning Specialization (Coursera), Fast.ai Practical Deep Learning (in progress)

SKILLS
Analysis: SQL (MySQL, PostgreSQL), Excel (advanced), Power BI, Tableau
Programming: Python (pandas, numpy, matplotlib — intermediate)
Statistics: Hypothesis testing, regression analysis, A/B testing
Other: Power Automate, Google Analytics, Jira`,
        status: 'completed',
        links: {
          github: null,
          linkedin: 'https://linkedin.com/in/datvo-analyst',
          portfolio: [],
          classified: [],
        },
        parsedCV: {
          summary:
            'Data analyst with 2 years of experience in reports, dashboards, and data visualizations. Interested in transitioning to ML.',
          skills: [
            'SQL',
            'Python',
            'Power BI',
            'Tableau',
            'Excel',
            'pandas',
            'numpy',
            'matplotlib',
          ],
          experience: [
            {
              title: 'Data Analyst',
              company: 'Masan Group',
              duration: '2023 - Present',
              description:
                'Sales reports and KPI dashboards using Power BI. Python automation scripts.',
            },
            {
              title: 'Junior Data Analyst',
              company: 'PwC Vietnam',
              duration: '2022 - 2023',
              description:
                'Data extraction and validation for audit team. Excel models and Tableau dashboards.',
            },
          ],
          education: [
            {
              degree: 'B.S. Business Administration',
              school: 'Foreign Trade University, HCMC',
              year: '2022',
            },
          ],
        },
        enrichment: {
          github: null,
          linkedin: null,
        },
        matchResult: {
          overallScore: 34,
          explanation:
            'Vo Thanh Dat is a data analyst aspiring to transition into machine learning, but currently lacks the core skills required for this ML Engineer role. He has no experience with PyTorch, TensorFlow, or any ML frameworks. His Python skills are intermediate (pandas/matplotlib level), far below the advanced Python and ML engineering skills needed. He has no experience with model training, deployment, or LLMs. His educational background is in Business Administration, not Computer Science or a quantitative field. While his interest in ML is evident from online courses (Andrew Ng, Fast.ai), completing coursework alone does not prepare someone for a production ML engineering role.',
          strengths: [
            'Basic Python and SQL skills provide a foundation to build upon',
            'Shows initiative with ML coursework (Andrew Ng, Fast.ai)',
            'Data analysis experience provides understanding of data quality and preprocessing',
            'A/B testing experience shows basic statistical understanding',
          ],
          gaps: [
            'No PyTorch, TensorFlow, or ML framework experience',
            'No model training, evaluation, or deployment experience',
            'No experience with LLMs, NLP, or computer vision',
            'Python skills at intermediate level — needs advanced proficiency',
            'Business Administration degree, not CS or quantitative field',
            'No GitHub profile or ML project portfolio',
            'No production engineering experience (the "E" in ML Engineer)',
          ],
          recommendation: 'weak_match',
          improvementTips: [
            'This candidate would benefit from 1-2 years of focused ML study and practice before being ready for this role',
            'Suggest they build personal ML projects and publish them on GitHub',
            'Consider for a junior data engineering or analytics engineering role instead',
            'The Fast.ai course (in progress) is a good direction — encourage completion and hands-on projects',
          ],
        },
        enrichmentProgress: {},
        progressLogs: [
          'CV uploaded successfully',
          'PDF parsed — extracted 734 words',
          'No GitHub profile found — skipping enrichment',
          'Match scoring complete — 34/100 (weak_match)',
        ],
        retryCount: 0,
      })
    )

    this.logger.log('Seeded 5 candidates across 4 jobs')
  }

  private async seedBulkJobs(companyIds: string[]) {
    const bulkJobs = [
      {
        title: 'iOS Developer (Swift)',
        desc: 'native iOS apps with SwiftUI',
        reqs: ['3+ years Swift', 'SwiftUI/UIKit', 'Core Data', 'Published App Store apps'],
      },
      {
        title: 'Android Developer (Kotlin)',
        desc: 'native Android apps with Jetpack Compose',
        reqs: [
          '3+ years Kotlin',
          'Jetpack Compose',
          'MVVM architecture',
          'Published Play Store apps',
        ],
      },
      {
        title: 'Site Reliability Engineer',
        desc: 'maintain 99.99% uptime for production systems',
        reqs: ['3+ years SRE', 'Kubernetes', 'Prometheus/Grafana', 'Incident management'],
      },
      {
        title: 'Data Engineer',
        desc: 'build and maintain data pipelines at scale',
        reqs: [
          '3+ years data engineering',
          'Apache Spark or Flink',
          'Airflow/Dagster',
          'SQL and Python',
        ],
      },
      {
        title: 'Product Manager',
        desc: 'drive product strategy for B2B SaaS platform',
        reqs: [
          '3+ years PM experience',
          'B2B SaaS background',
          'Data-driven decision making',
          'Technical literacy',
        ],
      },
      {
        title: 'UX/UI Designer',
        desc: 'design intuitive user experiences for web and mobile',
        reqs: [
          '3+ years UX design',
          'Figma proficiency',
          'User research skills',
          'Design systems experience',
        ],
      },
      {
        title: 'Technical Writer',
        desc: 'create developer documentation and API guides',
        reqs: [
          '2+ years technical writing',
          'API documentation',
          'Markdown/MDX',
          'Developer audience experience',
        ],
      },
      {
        title: 'Security Engineer',
        desc: 'implement security best practices and conduct audits',
        reqs: ['3+ years security', 'OWASP Top 10', 'Penetration testing', 'SOC 2 compliance'],
      },
      {
        title: 'Blockchain Developer (Solidity)',
        desc: 'build smart contracts and DeFi protocols',
        reqs: ['2+ years Solidity', 'EVM chains', 'DeFi protocols', 'Hardhat/Foundry'],
      },
      {
        title: 'Go Backend Developer',
        desc: 'build high-performance microservices in Go',
        reqs: ['3+ years Go', 'gRPC/REST APIs', 'PostgreSQL', 'Docker/Kubernetes'],
      },
      {
        title: 'Rust Systems Engineer',
        desc: 'develop low-latency systems and infrastructure tools',
        reqs: [
          '2+ years Rust',
          'Systems programming',
          'Async runtime (Tokio)',
          'Performance optimization',
        ],
      },
      {
        title: 'Platform Engineer',
        desc: 'build internal developer platform and tooling',
        reqs: [
          '3+ years platform eng',
          'Kubernetes operators',
          'CI/CD pipelines',
          'Developer experience',
        ],
      },
      {
        title: 'Engineering Manager',
        desc: 'lead a team of 6-8 engineers building payment systems',
        reqs: [
          '5+ years engineering',
          '2+ years people management',
          'Agile/Scrum',
          'Technical architecture',
        ],
      },
      {
        title: 'Solutions Architect',
        desc: 'design technical solutions for enterprise clients',
        reqs: [
          '5+ years architecture',
          'Cloud platforms (AWS/GCP)',
          'Enterprise integration',
          'Client-facing skills',
        ],
      },
      {
        title: 'Database Administrator',
        desc: 'manage and optimize PostgreSQL and MongoDB clusters',
        reqs: ['3+ years DBA', 'PostgreSQL tuning', 'Replication/HA', 'Backup and recovery'],
      },
      {
        title: 'AI/ML Ops Engineer',
        desc: 'build ML infrastructure and model serving pipelines',
        reqs: [
          '2+ years MLOps',
          'Kubeflow/MLflow',
          'Model serving (TensorRT, Triton)',
          'CI/CD for ML',
        ],
      },
      {
        title: 'Embedded Systems Engineer',
        desc: 'develop firmware for IoT devices',
        reqs: [
          '3+ years embedded C/C++',
          'RTOS experience',
          'BLE/WiFi protocols',
          'Hardware debugging',
        ],
      },
      {
        title: 'Network Engineer',
        desc: 'design and manage enterprise network infrastructure',
        reqs: ['3+ years networking', 'CCNA/CCNP', 'SD-WAN', 'Network security'],
      },
      {
        title: 'Salesforce Developer',
        desc: 'customize Salesforce platform with Apex and LWC',
        reqs: [
          '2+ years Salesforce',
          'Apex programming',
          'Lightning Web Components',
          'Salesforce certification',
        ],
      },
      {
        title: 'SAP Consultant (FICO)',
        desc: 'implement and configure SAP Finance modules',
        reqs: ['3+ years SAP FICO', 'S/4HANA migration', 'ABAP basics', 'SAP certification'],
      },
      {
        title: 'Cloud Architect (AWS)',
        desc: 'design scalable cloud architecture on AWS',
        reqs: [
          '5+ years AWS',
          'Well-Architected Framework',
          'Multi-account strategy',
          'Cost optimization',
        ],
      },
      {
        title: 'Vue.js Frontend Developer',
        desc: 'build SPAs with Vue 3 and Nuxt',
        reqs: ['2+ years Vue.js', 'Composition API', 'Pinia/Vuex', 'Nuxt 3'],
      },
      {
        title: 'Angular Developer',
        desc: 'develop enterprise web applications with Angular',
        reqs: ['3+ years Angular', 'RxJS', 'NgRx', 'Angular Material'],
      },
      {
        title: 'PHP Developer (Laravel)',
        desc: 'build web applications with Laravel',
        reqs: ['3+ years PHP/Laravel', 'MySQL/PostgreSQL', 'Redis', 'REST API design'],
      },
      {
        title: 'Ruby on Rails Developer',
        desc: 'maintain and scale Ruby on Rails applications',
        reqs: ['3+ years Rails', 'PostgreSQL', 'Sidekiq/Redis', 'RSpec testing'],
      },
      {
        title: '.NET Developer (C#)',
        desc: 'build enterprise applications with .NET 8',
        reqs: ['3+ years C#/.NET', 'ASP.NET Core', 'Entity Framework', 'Azure DevOps'],
      },
      {
        title: 'Elixir/Phoenix Developer',
        desc: 'build real-time applications with Elixir',
        reqs: ['2+ years Elixir', 'Phoenix Framework', 'OTP/GenServer', 'PostgreSQL'],
      },
      {
        title: 'Scala Developer',
        desc: 'build data processing systems with Scala and Spark',
        reqs: ['3+ years Scala', 'Apache Spark', 'Akka', 'Functional programming'],
      },
      {
        title: 'Flutter Developer',
        desc: 'build cross-platform mobile apps with Flutter',
        reqs: [
          '2+ years Flutter/Dart',
          'State management (Riverpod/Bloc)',
          'Published apps',
          'Platform channels',
        ],
      },
      {
        title: 'Technical Support Engineer',
        desc: 'provide L2/L3 support for SaaS platform',
        reqs: [
          '2+ years tech support',
          'SQL debugging',
          'API troubleshooting',
          'Customer communication',
        ],
      },
      {
        title: 'Growth Engineer',
        desc: 'build experimentation infrastructure and growth features',
        reqs: [
          '2+ years growth/fullstack',
          'A/B testing frameworks',
          'Analytics (Amplitude/Mixpanel)',
          'SQL',
        ],
      },
      {
        title: 'Computer Vision Engineer',
        desc: 'develop image recognition and video analytics systems',
        reqs: ['3+ years CV', 'PyTorch/TensorFlow', 'OpenCV', 'Object detection/segmentation'],
      },
      {
        title: 'NLP Engineer',
        desc: 'build text processing and language understanding systems',
        reqs: [
          '3+ years NLP',
          'Transformers/BERT',
          'spaCy/Hugging Face',
          'Text classification/NER',
        ],
      },
      {
        title: 'Game Developer (Unity)',
        desc: 'develop mobile and PC games with Unity',
        reqs: ['2+ years Unity/C#', 'Shader programming', 'Physics systems', 'Published games'],
      },
      {
        title: 'Unreal Engine Developer',
        desc: 'build AAA-quality game experiences',
        reqs: ['3+ years UE5', 'C++ and Blueprints', '3D rendering', 'Multiplayer networking'],
      },
      {
        title: 'ETL Developer',
        desc: 'build data integration pipelines with modern tools',
        reqs: ['2+ years ETL', 'dbt', 'Snowflake/BigQuery', 'Python/SQL'],
      },
      {
        title: 'Scrum Master',
        desc: 'facilitate agile processes for engineering teams',
        reqs: [
          '2+ years Scrum Master',
          'CSM/PSM certification',
          'Jira administration',
          'Conflict resolution',
        ],
      },
      {
        title: 'Business Analyst',
        desc: 'bridge business needs and technical implementation',
        reqs: [
          '2+ years BA',
          'Requirements gathering',
          'Process modeling (BPMN)',
          'Stakeholder management',
        ],
      },
      {
        title: 'Content Strategist',
        desc: 'develop content strategy for developer platform',
        reqs: [
          '3+ years content',
          'SEO knowledge',
          'Developer marketing',
          'Analytics-driven approach',
        ],
      },
      {
        title: 'Customer Success Manager',
        desc: 'drive adoption and retention for enterprise clients',
        reqs: ['3+ years CSM', 'SaaS experience', 'Churn prevention', 'Executive communication'],
      },
      {
        title: 'Infrastructure Engineer',
        desc: 'manage bare-metal and cloud hybrid infrastructure',
        reqs: ['3+ years infrastructure', 'Linux administration', 'Networking', 'Ansible/Puppet'],
      },
      {
        title: 'Release Engineer',
        desc: 'manage release processes and deployment automation',
        reqs: [
          '2+ years release eng',
          'CI/CD (Jenkins/GitHub Actions)',
          'Docker',
          'Release coordination',
        ],
      },
    ]

    const jobs: Partial<JobEntity>[] = []

    for (let i = 0; i < bulkJobs.length; i++) {
      const b = bulkJobs[i]
      const companyId = companyIds[i % companyIds.length]
      const yearsReq = b.reqs[0].match(/\d+/)?.[0] || '2'

      jobs.push({
        companyId,
        title: b.title,
        description: `## About the Role\n\nWe are hiring a **${b.title}** to ${b.desc}.\n\n## What You'll Do\n\n- Lead technical initiatives in your domain\n- Collaborate with cross-functional teams\n- Write clean, tested, production-ready code\n- Participate in design reviews and architecture discussions\n- Mentor junior team members\n\n## Requirements\n\n${b.reqs.map((r) => `- ${r}`).join('\n')}\n\n## Benefits\n\n- Competitive salary + annual bonus\n- Flexible working hours\n- Health insurance for you and family\n- Learning & development budget`,
        requirements: b.reqs,
        screeningCriteria:
          i % 3 === 0
            ? `Prefer candidates with ${yearsReq}+ years of hands-on experience.\nMust have GitHub or portfolio demonstrating relevant work.\nBonus: open source contributions or technical blog posts.`
            : null,
        isActive: i % 7 !== 0, // ~15% inactive to demo filtering
      })
    }

    await this.jobRepo.save(jobs.map((j) => this.jobRepo.create(j)))
    this.logger.log(`Seeded ${jobs.length} additional jobs for infinite scroll demo`)
  }
}
