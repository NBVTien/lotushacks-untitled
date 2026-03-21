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

  @Column()
  companyId!: string

  @ManyToOne(() => CompanyEntity, (c) => c.users)
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity

  @CreateDateColumn()
  createdAt!: Date
}
