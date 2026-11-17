import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MailService } from './mail.service.js';
import { MailoraRequestGuard, SessionGuard } from '../common/session.guard.js';

type AuthenticatedRequest = Request & { user: any };

@Controller('api')
@UseGuards(SessionGuard, MailoraRequestGuard)
export class MailController {
  constructor(@Inject(MailService) private readonly mail: MailService) {}

  @Get('inbox') inbox(@Req() request: AuthenticatedRequest, @Query() query: any) {
    return this.mail.inbox(request.user, query);
  }

  @Post('sync') @HttpCode(202)
  sync(@Req() request: AuthenticatedRequest) { return this.mail.sync(request.user); }

  @Get('threads/:id') thread(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.mail.thread(request.user, id);
  }

  @Post('threads/:id/done') @HttpCode(200)
  done(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.mail.done(request.user, id);
  }

  @Put('threads/:id/pin') pin(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.mail.pin(request.user, id, body);
  }

  @Post('threads/:id/snooze') @HttpCode(200)
  snooze(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.mail.snooze(request.user, id, body);
  }
}
