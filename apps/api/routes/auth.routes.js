import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/user.model.js";
import { decryptTokens, encryptTokens } from "../utils/token-vault.js";

export const authRouter = Router();
const sessionCookie = "mailora_session";
const stateCookie = "mailora_oauth_state";
const scopes = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

function config() {
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL", "JWT_SECRET", "TOKEN_ENCRYPTION_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
    oauth: new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_CALLBACK_URL),
  };
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

function sessionUserId(req) {
  try {
    const payload = jwt.verify(req.cookies?.[sessionCookie], process.env.JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

async function gmailConnected(user) {
  if (!user.encryptedGmailTokens) return false;
  let tokens;
  try { tokens = decryptTokens(user.encryptedGmailTokens); } catch { return false; }
  const granted = new Set((tokens.scope || "").split(" "));
  if (!scopes.slice(3).every((scope) => granted.has(scope))) return false;
  if (tokens.access_token && Number(tokens.expiry_date) > Date.now() + 60_000) return true;
  if (!tokens.refresh_token) return false;
  try {
    const oauth = config().oauth;
    oauth.setCredentials(tokens);
    const refreshed = await oauth.refreshAccessToken();
    user.encryptedGmailTokens = encryptTokens({ ...tokens, ...refreshed.credentials, refresh_token: tokens.refresh_token });
    await user.save();
    return true;
  } catch { return false; }
}

authRouter.get("/google", asyncRoute(async (_req, res) => {
  const { oauth } = config();
  const state = randomBytes(32).toString("hex");
  res.cookie(stateCookie, state, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
  res.redirect(oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: scopes, state }));
}));

authRouter.get("/google/callback", asyncRoute(async (req, res) => {
  const { oauth, clientUrl } = config();
  const expected = req.cookies?.[stateCookie];
  const received = req.query.state;
  res.clearCookie(stateCookie, cookieOptions());
  if (typeof expected !== "string" || typeof received !== "string" ||
      expected.length !== received.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received)) ||
      typeof req.query.code !== "string") {
    return res.status(400).json({ message: "Invalid sign-in request" });
  }

  const { tokens } = await oauth.getToken(req.query.code);
  if (!tokens.access_token) return res.status(400).json({ message: "Google sign-in did not return an access token" });
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) throw new Error("Could not read Google profile");
  const profile = await profileResponse.json();
  if (!profile.sub || !profile.email || !profile.email_verified) {
    return res.status(400).json({ message: "A verified Google email is required" });
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
  user.encryptedGmailTokens = encryptTokens({
    ...previous, ...tokens,
    refresh_token: tokens.refresh_token || previous.refresh_token,
    scope: tokens.scope || previous.scope,
  });
  await user.save();

  const session = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: "7d" });
  res.cookie(sessionCookie, session, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
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

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(sessionCookie, cookieOptions());
  res.status(204).end();
});
