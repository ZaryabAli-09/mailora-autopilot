import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AgentService } from './agent.service.js';
import { AgentRequestGuard, SessionGuard } from '../common/session.guard.js';

@Controller('api/agent')
@UseGuards(SessionGuard, AgentRequestGuard)
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

  @Post('ask') @HttpCode(200)
  ask(@Req() request: Request & { user: any }, @Body() body: any) {
    return this.agent.ask(request.user, body || {});
  }

  @Post('reply') @HttpCode(200)
  reply(@Req() request: Request & { user: any }, @Body() body: any) {
    return this.agent.reply(request.user, body);
  }
}
