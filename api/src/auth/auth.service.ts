import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UserEntity, CompanyEntity } from '../database'
import type { RegisterDto, LoginDto } from '@lotushack/shared'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterDto) {
    this.logger.log(`Register attempt: email=${dto.email}, company="${dto.companyName}"`)

    const exists = await this.userRepo.findOne({ where: { email: dto.email } })
    if (exists) {
      this.logger.warn(`Register failed: email already exists — ${dto.email}`)
      throw new ConflictException('Email already registered')
    }

    let company = await this.companyRepo.findOne({ where: { name: dto.companyName } })
    if (!company) {
      company = await this.companyRepo.save(this.companyRepo.create({ name: dto.companyName }))
      this.logger.log(`New company created: id=${company.id}, name="${company.name}"`)
    } else {
      this.logger.debug(`Existing company: id=${company.id}, name="${company.name}"`)
    }

    const hashed = await bcrypt.hash(dto.password, 10)
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        password: hashed,
        name: dto.name,
        companyId: company.id,
      })
    )

    this.logger.log(`User registered: id=${user.id}, email=${user.email}, companyId=${company.id}`)
    return this.buildResponse(user, company)
  }

  async login(dto: LoginDto) {
    this.logger.log(`Login attempt: email=${dto.email}`)

    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['company'],
    })
    if (!user) {
      this.logger.warn(`Login failed: user not found — ${dto.email}`)
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(dto.password, user.password)
    if (!valid) {
      this.logger.warn(`Login failed: wrong password — ${dto.email}`)
      throw new UnauthorizedException('Invalid credentials')
    }

    this.logger.log(
      `Login success: id=${user.id}, email=${user.email}, company="${user.company.name}"`
    )
    return this.buildResponse(user, user.company)
  }

  async validateUser(userId: string) {
    return this.userRepo.findOne({ where: { id: userId }, relations: ['company'] })
  }

  private buildResponse(user: UserEntity, company: CompanyEntity) {
    const payload = { sub: user.id, companyId: company.id }
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: company.id,
        company: {
          id: company.id,
          name: company.name,
          description: company.description,
          logo: company.logo,
          createdAt: company.createdAt,
        },
        createdAt: user.createdAt,
      },
    }
  }
}
