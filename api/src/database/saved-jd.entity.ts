import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { UserEntity } from './user.entity'

@Entity('saved_jds')
export class SavedJdEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @Column()
  title!: string

  @Column('text')
  description!: string

  @Column('text', { array: true, default: '{}' })
  requirements!: string[]

  @Column({ default: 'pasted' })
  source!: string

  @Column('varchar', { nullable: true })
  jobId!: string | null

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity

  @Column('jsonb', { nullable: true })
  lastAnalysis!: Record<string, unknown> | null

  @Column('jsonb', { nullable: true })
  lastResources!: Record<string, unknown>[] | null

  @CreateDateColumn()
  createdAt!: Date
}
