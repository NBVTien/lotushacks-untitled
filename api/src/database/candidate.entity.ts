import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import type {
  ExtractedLinks,
  EnrichedProfile,
  EnrichmentProgress,
  InterviewQuestionsResult,
  MatchResult,
  CandidateStatus,
  PipelineStage,
  CandidateNote,
  PipelineHistoryEntry,
  SurveyAnswer,
} from '@lotushack/shared'
import { JobEntity } from './job.entity'

@Entity('candidates')
export class CandidateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  jobId!: string

  @ManyToOne(() => JobEntity, (j) => j.candidates)
  @JoinColumn({ name: 'jobId' })
  job!: JobEntity

  @Column()
  name!: string

  @Column('varchar', { nullable: true })
  email!: string | null

  @Column()
  cvUrl!: string

  @Column('text', { default: '' })
  cvText!: string

  @Column('varchar', { nullable: true })
  phone!: string | null

  @Column('jsonb', { default: '{"github":null,"linkedin":null,"portfolio":[],"classified":[]}' })
  links!: ExtractedLinks

  @Column('jsonb', { nullable: true })
  parsedCV!: Record<string, unknown> | null

  @Column('jsonb', { nullable: true })
  enrichment!: EnrichedProfile | null

  @Column('jsonb', { nullable: true })
  extendedEnrichment!: Record<string, unknown> | null

  @Column('jsonb', { default: '{}' })
  enrichmentProgress!: EnrichmentProgress

  @Column('jsonb', { nullable: true })
  matchResult!: MatchResult | null

  @Column('jsonb', { nullable: true })
  interviewQuestions!: InterviewQuestionsResult | null

  @Column('jsonb', { nullable: true })
  surveyAnswers!: SurveyAnswer[] | null

  @Column({ default: 'uploaded' })
  status!: CandidateStatus

  @Column('text', { nullable: true })
  errorMessage!: string | null

  @Column('jsonb', { default: '[]' })
  progressLogs!: string[]

  @Column({ default: 0 })
  retryCount!: number

  @Column('varchar', { default: 'new' })
  pipelineStage!: PipelineStage

  @Column('jsonb', { default: '[]' })
  notes!: CandidateNote[]

  @Column('jsonb', { default: '[]' })
  pipelineHistory!: PipelineHistoryEntry[]

  @CreateDateColumn()
  createdAt!: Date
}
