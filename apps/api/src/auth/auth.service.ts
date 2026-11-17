import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { User } from '../database/models/user.model.js';
import { decryptTokens, encryptTokens } from './token-vault.js';
import { accessTokenFor, googleClient, hasGmailAccess, requestedScopes } from './google-token.service.js';
import { queueSync } from '../mail/sync.service.js';
import { OAUTH_STATE_COOKIE, SESSION_COOKIE } from '../common/session.guard.js';

function config() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'JWT_SECRET', 'TOKEN_ENCRYPTION_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return { clientUrl: process.env.CLIENT_URL || 'http://localhost:3000', oauth: googleClient() };
}

function cookieOptions() {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  if (domain && !/^(?:\.)?(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new Error('COOKIE_DOMAIN must be a valid domain name or empty');
  }
  return {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const,
    path: '/', ...(domain ? { domain } : {}),
  };
}

function loginErrorUrl(clientUrl: string, code: string) {
  const url = new URL('/login', clientUrl);
  url.searchParams.set('error', code);
  return url.toString();
}

/** Token refresh is the connection check; only reconnect errors mark it disconnected. */
export async function gmailConnected(user: any): Promise<boolean> {
  try { await accessTokenFor(user); return true; }
  catch (error: any) { return error.statusCode !== 409; }
}

@Injectable()
export class AuthService {
  startGoogle(response: Response) {
    const { oauth } = config();
    const state = randomBytes(32).toString('hex');
    response.set('Cache-Control', 'no-store');
    response.cookie(OAUTH_STATE_COOKIE, state, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
    return response.redirect(oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: requestedScopes, state }));
  }

  async finishGoogle(request: Request, response: Response) {
    const { oauth, clientUrl } = config();
    const expected = request.cookies?.[OAUTH_STATE_COOKIE];
    const received = request.query.state;
    response.set('Cache-Control', 'no-store');
    response.clearCookie(OAUTH_STATE_COOKIE, cookieOptions());
    if (typeof expected !== 'string' || typeof received !== 'string' ||
        expected.length !== received.length ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(received)) ||
        typeof request.query.code !== 'string') {
      return response.redirect(303, loginErrorUrl(clientUrl, 'oauth_state'));
    }

    let tokens: any;
    let profile: any;
    try {
      ({ tokens } = await oauth.getToken(request.query.code));
      if (!tokens.access_token) throw new Error('Access token missing');
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15_000),
      });
      if (!profileResponse.ok) throw new Error('Could not read Google profile');
      profile = await profileResponse.json();
    } catch {
      return response.redirect(303, loginErrorUrl(clientUrl, 'oauth_failed'));
    }
    if (!profile.sub || !profile.email || !profile.email_verified) {
      return response.redirect(303, loginErrorUrl(clientUrl, 'oauth_failed'));
    }

    let user = await User.findOne({ googleId: profile.sub }).select('+encryptedGmailTokens');
    let previous: any = {};
    if (user?.encryptedGmailTokens) {
      try { previous = decryptTokens(user.encryptedGmailTokens); } catch { /* reconnect replaces invalid tokens */ }
    }
    if (!user) user = new User({ googleId: profile.sub });
    user.email = profile.email;
    user.name = profile.name || profile.email;
    user.avatarUrl = profile.picture || undefined;
    const savedTokens = {
      ...previous, ...tokens,
      refresh_token: tokens.refresh_token || previous.refresh_token,
      scope: tokens.scope || previous.scope,
    };
    if (!savedTokens.refresh_token || !hasGmailAccess(savedTokens.scope)) {
      return response.redirect(303, loginErrorUrl(clientUrl, 'gmail_access'));
    }
    user.encryptedGmailTokens = encryptTokens(savedTokens);
    await user.save();
    const session = jwt.sign({}, process.env.JWT_SECRET!, { subject: String(user.id), expiresIn: '7d' });
    response.cookie(SESSION_COOKIE, session, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
    queueSync(user.id, { force: true });
    return response.redirect(`${clientUrl}/app`);
  }

  async me(request: Request, response: Response) {
    let userId: string;
    try {
      const payload = jwt.verify(request.cookies?.[SESSION_COOKIE], process.env.JWT_SECRET!) as jwt.JwtPayload;
      userId = typeof payload.sub === 'string' ? payload.sub : '';
    } catch { userId = ''; }
    if (!userId) return response.status(401).json({ message: 'Not signed in' });
    const user = await User.findById(userId).select('+encryptedGmailTokens');
    if (!user) return response.status(401).json({ message: 'Not signed in' });
    const connected = await gmailConnected(user);
    response.set('Cache-Control', 'no-store');
    return response.json({
      user: { id: String(user.id), name: user.name, email: user.email, avatarUrl: user.avatarUrl || null },
      gmailConnected: connected,
    });
  }

  logout(response: Response) {
    response.clearCookie(SESSION_COOKIE, cookieOptions());
    return response.status(204).end();
  }
}
