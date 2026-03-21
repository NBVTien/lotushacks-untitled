import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { CandidateEntity } from './candidate.entity'
import { CompanyEntity } from './company.entity'

@Entity('jobs')
export class JobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  companyId!: string

  @ManyToOne(() => CompanyEntity, (c) => c.jobs)
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity

  @Column()
  title!: string

  @Column('text')
  description!: string

  @Column('text', { array: true, default: '{}' })
  requirements!: string[]

  @Column('text', { nullable: true })
  screeningCriteria!: string | null

  @Column({ default: true })
  isActive!: boolean

  @CreateDateColumn()
  createdAt!: Date

  @OneToMany(() => CandidateEntity, (c) => c.job)
  candidates!: CandidateEntity[]
}
