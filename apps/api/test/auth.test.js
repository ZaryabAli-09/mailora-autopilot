import assert from "node:assert/strict";
import { test } from "node:test";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { encryptTokens, decryptTokens } from "../src/auth/token-vault.js";
import { gmailConnected } from "../src/auth/auth.service.ts";
import { User } from "../src/database/models/user.model.js";
import { AgentService } from "../src/agent/agent.service.ts";
import { MailService } from "../src/mail/mail.service.ts";

process.env.NODE_ENV = "test";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:8000/auth/google/callback";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);

test("Gmail tokens are encrypted and reject tampering", () => {
  const tokens = { access_token: "access-token", refresh_token: "refresh-token", scope: "gmail.readonly" };
  const encrypted = encryptTokens(tokens);
  assert.ok(!encrypted.includes("refresh-token"));
  assert.deepEqual(decryptTokens(encrypted), tokens);
  const parts = encrypted.split(".");
  parts[2] = `${parts[2].slice(0, -2)}zz`;
  assert.throws(() => decryptTokens(parts.join(".")));
});

test("Gmail connection requires a live token with usable Gmail scope", async () => {
  const scopes = ["https://mail.google.com/", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];
  assert.equal(await gmailConnected({ encryptedGmailTokens: null }), false);
  const user = { encryptedGmailTokens: encryptTokens({ access_token: "ok", refresh_token: "refresh", expiry_date: Date.now() + 3600_000, scope: scopes.join(" ") }) };
  assert.equal(await gmailConnected(user), true);
  user.encryptedGmailTokens = encryptTokens({ access_token: "ok", refresh_token: "refresh", expiry_date: Date.now() + 3600_000, scope: scopes.slice(1).join(" ") });
  assert.equal(await gmailConnected(user), false);
  user.encryptedGmailTokens = encryptTokens({ access_token: "expired", expiry_date: Date.now() - 1000, scope: scopes.join(" ") });
  assert.equal(await gmailConnected(user), false);
});

test("one Google flow requests profile and all Gmail scopes with offline access", async (t) => {
  const { createApp } = await import("../src/app.ts");
  const app = await createApp();
  await app.listen(0);
  t.after(() => app.close());
  const base = await app.getUrl();

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  const privateInbox = await fetch(`${base}/api/inbox`);
  assert.equal(privateInbox.status, 401);
  assert.deepEqual(await privateInbox.json(), { message: "Not signed in" });
  const privateAgent = await fetch(`${base}/api/agent/ask`, { method: "POST", headers: { "X-Mailora-Request": "1" } });
  assert.equal(privateAgent.status, 401);
  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { message: "Route not found" });

  const response = await fetch(`${base}/auth/google`, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.match(response.headers.get("set-cookie"), /mailora_oauth_state=.*HttpOnly/i);
  assert.match(response.headers.get("set-cookie"), /SameSite=Lax/i);
  assert.doesNotMatch(response.headers.get("set-cookie"), /Domain=/i);
  const url = new URL(response.headers.get("location"));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  const scopes = url.searchParams.get("scope").split(" ");
  for (const scope of ["openid", "email", "profile", "https://mail.google.com/", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"]) {
    assert.ok(scopes.includes(scope), `Missing ${scope}`);
  }

  const me = await fetch(`${base}/auth/me`);
  assert.equal(me.status, 401);
  const invalidCallback = await fetch(`${base}/auth/google/callback?state=wrong&code=invalid`, { redirect: "manual" });
  assert.equal(invalidCallback.status, 303);
  assert.equal(invalidCallback.headers.get("location"), "http://localhost:3000/login?error=oauth_state");

  const originalGetToken = OAuth2Client.prototype.getToken;
  let tokenExchangeReached = false;
  OAuth2Client.prototype.getToken = async () => { tokenExchangeReached = true; throw new Error("Expected test exchange failure"); };
  t.after(() => { OAuth2Client.prototype.getToken = originalGetToken; });
  const stateCookie = response.headers.get("set-cookie").split(";")[0];
  const validCallback = await fetch(`${base}/auth/google/callback?state=${encodeURIComponent(url.searchParams.get("state"))}&code=unused-test-code`, {
    headers: { Cookie: stateCookie }, redirect: "manual",
  });
  assert.equal(tokenExchangeReached, true);
  assert.equal(validCallback.status, 303);
  assert.equal(validCallback.headers.get("location"), "http://localhost:3000/login?error=oauth_failed");

  const logout = await fetch(`${base}/auth/logout`, { method: "POST", headers: { "X-Mailora-Request": "1" } });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie"), /mailora_session=;/);
  const rejectedLogout = await fetch(`${base}/auth/logout`, { method: "POST" });
  assert.equal(rejectedLogout.status, 403);
  assert.deepEqual(await rejectedLogout.json(), { message: "Request rejected" });

  const findById = User.findById;
  User.findById = () => ({ select: async () => ({ id: "test-user", email: "me@example.com" }) });
  t.after(() => { User.findById = findById; });
  const session = jwt.sign({}, process.env.JWT_SECRET, { subject: "test-user" });
  const cookie = `mailora_session=${session}`;
  const badThread = await fetch(`${base}/api/threads/bad`, { headers: { Cookie: cookie } });
  assert.equal(badThread.status, 400);
  assert.deepEqual(await badThread.json(), { message: "Invalid thread ID" });
  const badAsk = await fetch(`${base}/api/agent/ask`, {
    method: "POST", headers: { Cookie: cookie, "X-Mailora-Request": "1", "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "" }),
  });
  assert.equal(badAsk.status, 400);
  assert.deepEqual(await badAsk.json(), { message: "Enter a request under 2,000 characters" });

  const agentService = app.get(AgentService);
  const mailService = app.get(MailService);
  const originalAsk = agentService.ask;
  const originalDone = mailService.done;
  agentService.ask = async () => ({ answer: "Hello", actions: [], contextCount: 0 });
  mailService.done = async () => ({ done: true });
  t.after(() => { agentService.ask = originalAsk; mailService.done = originalDone; });
  const agentSuccess = await fetch(`${base}/api/agent/ask`, {
    method: "POST", headers: { Cookie: cookie, "X-Mailora-Request": "1", "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Hello" }),
  });
  assert.equal(agentSuccess.status, 200);
  assert.deepEqual(await agentSuccess.json(), { answer: "Hello", actions: [], contextCount: 0 });
  const doneSuccess = await fetch(`${base}/api/threads/abcde/done`, {
    method: "POST", headers: { Cookie: cookie, "X-Mailora-Request": "1" },
  });
  assert.equal(doneSuccess.status, 200);
  assert.deepEqual(await doneSuccess.json(), { done: true });
});
