import { Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { MailoraRequestGuard } from '../common/session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('google')
  google(@Res() response: Response) { return this.auth.startGoogle(response); }

  @Get('google/callback')
  callback(@Req() request: Request, @Res() response: Response) {
    return this.auth.finishGoogle(request, response);
  }

  @Get('me')
  me(@Req() request: Request, @Res() response: Response) {
    return this.auth.me(request, response);
  }

  @Post('logout')
  @UseGuards(MailoraRequestGuard)
  logout(@Res() response: Response) { return this.auth.logout(response); }
}
