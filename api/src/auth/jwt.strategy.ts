import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET', 'hackathon-secret-2026'),
    })
  }

  async validate(payload: { sub: string; companyId?: string; role?: string }) {
    const user = await this.authService.validateUser(payload.sub)
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: payload.role || user.role || 'recruiter',
      companyId: payload.companyId || null,
    }
  }
}
