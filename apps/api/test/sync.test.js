import assert from "node:assert/strict";
import { test } from "node:test";
import { emailFromGmail } from "../services/sync.service.js";

test("Gmail message mapping stores text and metadata without attachment content", () => {
  const message = {
    id: "message-123", threadId: "thread-123", internalDate: "1761510000000",
    snippet: "Calendar invitation", labelIds: ["INBOX", "UNREAD"],
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "Team <team@example.com>" },
        { name: "Subject", value: "Meeting" },
        { name: "List-Unsubscribe", value: "<mailto:unsubscribe@example.com>" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: Buffer.from("Meet at ten.").toString("base64url") } },
        { mimeType: "application/pdf", filename: "private.pdf", body: { data: Buffer.from("attachment bytes").toString("base64url") } },
      ],
    },
  };
  const email = emailFromGmail(message);
  assert.equal(email.gmailMessageId, "message-123");
  assert.equal(email.threadId, "thread-123");
  assert.equal(email.body, "Meet at ten.");
  assert.equal(email.hasUnsubscribeHeader, true);
  assert.deepEqual(email.labelIds, ["INBOX", "UNREAD"]);
  assert.ok(!JSON.stringify(email).includes("attachment bytes"));
});
