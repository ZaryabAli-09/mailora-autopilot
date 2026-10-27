import assert from "node:assert/strict";
import { test } from "node:test";
import { presentSummary, presentThread } from "../services/thread-presenter.js";
import { gmailRequest, threadPath } from "../services/gmail.service.js";
import { encryptTokens } from "../utils/token-vault.js";

process.env.TOKEN_ENCRYPTION_KEY = "b".repeat(64);

const message = (body, labels = ["INBOX"]) => ({
  id: "message-1",
  internalDate: "1761510000000",
  labelIds: labels,
  payload: {
    mimeType: "text/html",
    headers: [
      { name: "Subject", value: "A real conversation" },
      { name: "From", value: "Sender <sender@example.com>" },
      { name: "To", value: "Reader <reader@example.com>" },
    ],
    body: { data: Buffer.from("<p>Hello <strong>reader</strong>.</p>").toString("base64url") },
  },
  snippet: body,
});

test("Gmail thread presenter groups provider categories and renders message text", () => {
  const thread = {
    id: "thread-123",
    snippet: "A summary",
    messages: [message("A summary", ["INBOX", "UNREAD", "CATEGORY_UPDATES"])],
  };
  const summary = presentSummary(thread, { pinned: true });
  assert.equal(summary.category, "updates");
  assert.equal(summary.unread, true);
  assert.equal(summary.pinned, true);
  assert.equal(summary.sender, "Sender <sender@example.com>");
  const detail = presentThread(thread);
  assert.equal(detail.messages[0].body, "Hello reader.");
  assert.equal(detail.messages[0].to, "Reader <reader@example.com>");
  assert.ok(!detail.messages[0].body.includes("<strong>"));
});

test("Gmail mutations use the connected user's encrypted token", async (t) => {
  const realFetch = global.fetch;
  t.after(() => { global.fetch = realFetch; });
  let seen;
  global.fetch = async (url, init) => {
    seen = { url: String(url), ...init };
    return new Response(JSON.stringify({ id: "thread-123" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  const user = { encryptedGmailTokens: encryptTokens({
    access_token: "user-access-token",
    refresh_token: "user-refresh-token",
    expiry_date: Date.now() + 3_600_000,
    scope: "https://mail.google.com/",
  }) };
  const response = await gmailRequest(user, `${threadPath("thread-123")}/modify`, {
    method: "POST", body: { removeLabelIds: ["INBOX"] },
  });
  assert.equal(response.id, "thread-123");
  assert.equal(seen.url, "https://gmail.googleapis.com/gmail/v1/users/me/threads/thread-123/modify");
  assert.equal(seen.headers.Authorization, "Bearer user-access-token");
  assert.deepEqual(JSON.parse(seen.body), { removeLabelIds: ["INBOX"] });
  assert.throws(() => threadPath("../someone-else"), { statusCode: 400 });
});

test("disabled Gmail API reports the setup issue without discarding consent", async (t) => {
  const realFetch = global.fetch;
  t.after(() => { global.fetch = realFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    error: { errors: [{ reason: "accessNotConfigured" }] },
  }), { status: 403, headers: { "Content-Type": "application/json" } });
  const user = { encryptedGmailTokens: encryptTokens({
    access_token: "user-access-token", refresh_token: "user-refresh-token",
    expiry_date: Date.now() + 3_600_000, scope: "https://mail.google.com/",
  }) };
  await assert.rejects(gmailRequest(user, "/threads"), { statusCode: 503, code: "GMAIL_API_DISABLED" });
  assert.ok(user.encryptedGmailTokens);
});
