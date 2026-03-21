import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { SourcedCandidate } from '@lotushack/shared'
import { JobEntity } from './job.entity'

@Entity('sourcing_results')
export class SourcingResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  jobId!: string

  @ManyToOne(() => JobEntity)
  @JoinColumn({ name: 'jobId' })
  job!: JobEntity

  @Column()
  query!: string

  @Column('jsonb', { default: '[]' })
  candidates!: SourcedCandidate[]

  @Column('simple-array', { default: '' })
  sources!: string[]

  @CreateDateColumn()
  searchedAt!: Date
}
