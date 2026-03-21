import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm'
import { UserEntity } from './user.entity'
import { JobEntity } from './job.entity'

@Entity('companies')
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column('text', { nullable: true })
  description!: string | null

  @Column('varchar', { nullable: true })
  logo!: string | null

  @CreateDateColumn()
  createdAt!: Date

  @OneToMany(() => UserEntity, (u) => u.company)
  users!: UserEntity[]

  @OneToMany(() => JobEntity, (j) => j.company)
  jobs!: JobEntity[]
}
