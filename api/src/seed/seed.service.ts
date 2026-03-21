import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { CompanyEntity, UserEntity, JobEntity } from '../database'

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name)

  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>
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
        companyId: techCorp.id,
      }),
      this.userRepo.create({
        email: 'hr@moonlight.example',
        password: hashedPassword,
        name: 'Bob Recruiter',
        companyId: startupAI.id,
      }),
      this.userRepo.create({
        email: 'hr@nova.example',
        password: hashedPassword,
        name: 'Charlie Recruiter',
        companyId: globalSoft.id,
      }),
    ])

    // === TechCorp Jobs ===

    await this.jobRepo.save(
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

    await this.jobRepo.save(
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

    await this.jobRepo.save(
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

    await this.jobRepo.save(
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
