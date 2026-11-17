import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { AgentRequestGuard, SessionGuard } from '../common/session.guard.js';

@Module({ controllers: [AgentController], providers: [AgentService, SessionGuard, AgentRequestGuard] })
export class AgentModule {}
