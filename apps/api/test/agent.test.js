import assert from "node:assert/strict";
import { test } from "node:test";
import { askAgent } from "../services/agent.service.js";
import { composeReply, replyRecipient } from "../services/reply.service.js";
import { encryptTokens } from "../utils/token-vault.js";

process.env.TOKEN_ENCRYPTION_KEY = "c".repeat(64);

function message() {
  return {
    id: "message-123",
    internalDate: "1761510000000",
    labelIds: ["INBOX"],
    payload: { mimeType: "text/plain", headers: [
      { name: "From", value: "Sender <sender@example.com>" },
      { name: "Reply-To", value: "Replies <replies@example.com>" },
      { name: "Subject", value: "Quarterly report" },
      { name: "Message-ID", value: "<original@example.com>" },
    ], body: { data: Buffer.from("Here is the report.").toString("base64url") } },
  };
}

test("reply target comes from the live thread and MIME retains conversation headers", async () => {
  const target = replyRecipient({ messages: [message()] }, "me@example.com");
  assert.equal(target.address, "replies@example.com");
  const raw = await composeReply({ from: "me@example.com", to: target.address,
    subject: target.subject, text: "Thanks for the update.", messageId: target.messageId, references: target.references });
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /To: replies@example\.com/i);
  assert.match(mime, /Subject: Re: Quarterly report/i);
  assert.match(mime, /In-Reply-To: <original@example\.com>/i);
  assert.match(mime, /Thanks for the update\./);
});

test("agent uses live Gmail context and rejects actions outside it", async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.NEBIUS_API_KEY;
  const originalBase = process.env.NEBIUS_BASE_URL;
  const originalModel = process.env.NEBIUS_MODEL_CHAT;
  t.after(() => { global.fetch = originalFetch; process.env.NEBIUS_API_KEY = originalKey; process.env.NEBIUS_BASE_URL = originalBase; process.env.NEBIUS_MODEL_CHAT = originalModel; });
  process.env.NEBIUS_API_KEY = "test-key";
  process.env.NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
  process.env.NEBIUS_MODEL_CHAT = "test-chat-model";
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/threads?labelIds=INBOX&maxResults=12")) {
      return Response.json({ threads: [{ id: "thread-123" }] });
    }
    if (String(url).includes("/threads/thread-123")) {
      return Response.json({ id: "thread-123", messages: [message()] });
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      answer: "The quarterly report arrived.", actions: [
        { type: "done", threadId: "unknown-thread" },
        { type: "reply", threadId: "thread-123", draft: "Thank you", recipient: "attacker@example.com" },
      ],
    }) } }] });
  };
  const user = { email: "me@example.com", encryptedGmailTokens: encryptTokens({
    access_token: "connected-access-token", refresh_token: "connected-refresh-token",
    expiry_date: Date.now() + 3_600_000, scope: "https://mail.google.com/",
  }) };
  const result = await askAgent(user, { prompt: "Summarize this", threadId: "thread-123" });
  assert.equal(result.contextCount, 1);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].recipient, "replies@example.com");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.init.method === "GET" || call.init.method === "POST"));
  assert.ok(calls.filter((call) => call.url.includes("gmail.googleapis.com")).every((call) => call.init.method === "GET"));
  const providerBody = JSON.parse(calls[2].init.body);
  assert.match(providerBody.messages[0].content, /Here is the report/);
});

test("agent needs a configured provider key", async (t) => {
  const previous = process.env.NEBIUS_API_KEY;
  t.after(() => { process.env.NEBIUS_API_KEY = previous; });
  delete process.env.NEBIUS_API_KEY;
  await assert.rejects(askAgent({ email: "me@example.com" }, { prompt: "Hello" }), { statusCode: 503, code: "AI_NOT_CONFIGURED" });
});
