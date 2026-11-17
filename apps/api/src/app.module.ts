import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { MailModule } from './mail/mail.module.js';
import { AgentModule } from './agent/agent.module.js';
import { DatabaseModule } from './database/database.module.js';

@Controller()
class HealthController {
  @Get('health') health() { return { status: 'ok' }; }
}

@Module({ imports: [DatabaseModule, AuthModule, MailModule, AgentModule], controllers: [HealthController] })
export class AppModule {}
