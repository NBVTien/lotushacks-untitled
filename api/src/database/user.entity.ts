import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { CompanyEntity } from './company.entity'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  @Column()
  password!: string

  @Column()
  name!: string

  @Column({ default: 'recruiter' })
  role!: string

  @Column({ nullable: true })
  companyId!: string | null

  @ManyToOne(() => CompanyEntity, (c) => c.users)
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity

  @Column('text', { nullable: true })
  cvText!: string | null

  @Column('jsonb', { nullable: true })
  parsedCV!: Record<string, unknown> | null

  @CreateDateColumn()
  createdAt!: Date
}
