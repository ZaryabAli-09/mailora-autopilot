import { Injectable } from '@nestjs/common';
import { askAgent } from './agent-domain.service.js';
import { sendApprovedReply } from './reply.service.js';

@Injectable()
export class AgentService {
  ask(user: any, input: any) { return askAgent(user, input); }
  reply(user: any, input: any) { return sendApprovedReply(user, input); }
}
