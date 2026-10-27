import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { decryptTokens, encryptTokens } from "../utils/token-vault.js";
import { accessTokenFor, googleClient, hasGmailAccess, requestedScopes } from "../services/google-token.service.js";
import { queueSync } from "../services/sync.service.js";

export const authRouter = Router();
const sessionCookie = "mailora_session";
const stateCookie = "mailora_oauth_state";
function config() {
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL", "JWT_SECRET", "TOKEN_ENCRYPTION_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
    oauth: googleClient(),
  };
}

function cookieOptions() {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  if (domain && !/^(?:\.)?(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new Error("COOKIE_DOMAIN must be a valid domain name or empty");
  }
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

function loginErrorUrl(clientUrl, code) {
  const url = new URL("/login", clientUrl);
  url.searchParams.set("error", code);
  return url.toString();
}

function sessionUserId(req) {
  try {
    const payload = jwt.verify(req.cookies?.[sessionCookie], process.env.JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

export async function gmailConnected(user) {
  try { await accessTokenFor(user); return true; }
  catch (error) { return error.statusCode !== 409; }
}

authRouter.get("/google", asyncRoute(async (_req, res) => {
  const { oauth } = config();
  const state = randomBytes(32).toString("hex");
  res.set("Cache-Control", "no-store");
  res.cookie(stateCookie, state, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
  res.redirect(oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: requestedScopes, state }));
}));

authRouter.get("/google/callback", asyncRoute(async (req, res) => {
  const { oauth, clientUrl } = config();
  const expected = req.cookies?.[stateCookie];
  const received = req.query.state;
  res.set("Cache-Control", "no-store");
  res.clearCookie(stateCookie, cookieOptions());
  if (typeof expected !== "string" || typeof received !== "string" ||
      expected.length !== received.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received)) ||
      typeof req.query.code !== "string") {
    return res.redirect(303, loginErrorUrl(clientUrl, "oauth_state"));
  }

  let tokens;
  let profile;
  try {
    ({ tokens } = await oauth.getToken(req.query.code));
    if (!tokens.access_token) throw new Error("Access token missing");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileResponse.ok) throw new Error("Could not read Google profile");
    profile = await profileResponse.json();
  } catch {
    return res.redirect(303, loginErrorUrl(clientUrl, "oauth_failed"));
  }
  if (!profile.sub || !profile.email || !profile.email_verified) {
    return res.redirect(303, loginErrorUrl(clientUrl, "oauth_failed"));
  }

  let user = await User.findOne({ googleId: profile.sub }).select("+encryptedGmailTokens");
  let previous = {};
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
    return res.redirect(303, loginErrorUrl(clientUrl, "gmail_access"));
  }
  user.encryptedGmailTokens = encryptTokens(savedTokens);
  await user.save();

  const session = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: "7d" });
  res.cookie(sessionCookie, session, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
  queueSync(user.id, { force: true });
  res.redirect(`${clientUrl}/app`);
}));

authRouter.get("/me", asyncRoute(async (req, res) => {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ message: "Not signed in" });
  const user = await User.findById(userId).select("+encryptedGmailTokens");
  if (!user) return res.status(401).json({ message: "Not signed in" });
  const connected = await gmailConnected(user);
  res.set("Cache-Control", "no-store");
  res.json({ user: { id: String(user.id), name: user.name, email: user.email, avatarUrl: user.avatarUrl || null }, gmailConnected: connected });
}));

authRouter.post("/logout", (req, res) => {
  if (req.get("X-Mailora-Request") !== "1") return res.status(403).json({ message: "Request rejected" });
  res.clearCookie(sessionCookie, cookieOptions());
  res.status(204).end();
});
