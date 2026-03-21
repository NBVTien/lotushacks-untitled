import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import type { RegisterDto, LoginDto, CandidateRegisterDto } from '@lotushack/shared'
import type { Request } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('register-candidate')
  registerCandidate(@Body() dto: CandidateRegisterDto) {
    return this.authService.registerCandidate(dto)
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.user
  }
}
