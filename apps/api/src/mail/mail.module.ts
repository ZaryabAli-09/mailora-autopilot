import { Module } from '@nestjs/common';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';
import { SessionGuard, MailoraRequestGuard } from '../common/session.guard.js';
import { WorkersService } from './workers.service.js';

@Module({ controllers: [MailController], providers: [MailService, SessionGuard, MailoraRequestGuard, WorkersService], exports: [WorkersService] })
export class MailModule {}
