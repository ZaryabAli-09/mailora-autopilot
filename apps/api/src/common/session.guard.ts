import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { User } from '../database/models/user.model.js';

export const SESSION_COOKIE = 'mailora_session';
export const OAUTH_STATE_COOKIE = 'mailora_oauth_state';

/** Loads the same encrypted-token user document used by Gmail services. */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token || !process.env.JWT_SECRET) throw new UnauthorizedException('Not signed in');
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload;
      if (typeof payload.sub !== 'string') throw new Error('Invalid session');
      const user = await User.findById(payload.sub).select('+encryptedGmailTokens');
      if (!user) throw new Error('User not found');
      request.user = user;
      context.switchToHttp().getResponse().set('Cache-Control', 'no-store');
      return true;
    } catch {
      throw new UnauthorizedException('Not signed in');
    }
  }
}

/** Required for browser cookie mutations, including all agent requests. */
@Injectable()
export class MailoraRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'GET' || request.get('X-Mailora-Request') === '1') return true;
    throw new ForbiddenException('Request rejected');
  }
}

@Injectable()
export class AgentRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.switchToHttp().getRequest<Request>().get('X-Mailora-Request') === '1') return true;
    throw new ForbiddenException('Request rejected');
  }
}
