import { createHash } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import addressparser from "nodemailer/lib/addressparser/index.js";
import { ApiError } from "../utils/apiError.js";
import { AgentSend } from "../models/agent-send.model.js";
import { gmailRequest, threadPath } from "./gmail.service.js";

function header(message, name) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function addresses(value) {
  return addressparser(value).filter((entry) => entry.address && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(entry.address));
}

export function replyRecipient(thread, userEmail) {
  const latestExternal = [...(thread.messages || [])].reverse().find((message) =>
    addresses(header(message, "From")).some((entry) => entry.address.toLowerCase() !== userEmail.toLowerCase()));
  if (!latestExternal) return null;
  const sender = addresses(header(latestExternal, "From")).find((entry) => entry.address.toLowerCase() !== userEmail.toLowerCase());
  const replyTo = addresses(header(latestExternal, "Reply-To")).find((entry) => entry.address.toLowerCase() !== userEmail.toLowerCase());
  return {
    address: (replyTo || sender).address,
    messageId: header(latestExternal, "Message-ID"),
    references: header(latestExternal, "References"),
    subject: header(latestExternal, "Subject") || header(thread.messages?.[0] || {}, "Subject") || "(no subject)",
  };
}

export async function composeReply({ from, to, subject, text, messageId, references }) {
  const composer = new MailComposer({
    from, to, subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    text,
    ...(messageId ? { inReplyTo: messageId, references: [references, messageId].filter(Boolean).join(" ") } : {}),
  });
  const mime = await composer.compile().build();
  return mime.toString("base64url");
}

export async function sendApprovedReply(user, input) {
  const { threadId, text, recipient, idempotencyKey, confirm } = input || {};
  const path = threadPath(threadId);
  if (confirm !== true) throw new ApiError(400, "Review the draft and confirm before sending");
  if (typeof text !== "string" || !text.trim() || text.length > 20_000) throw new ApiError(400, "Enter a reply under 20,000 characters");
  if (typeof recipient !== "string" || recipient.length > 320) throw new ApiError(400, "Invalid recipient");
  if (typeof idempotencyKey !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw new ApiError(400, "Invalid send request");
  const bodyHash = createHash("sha256").update(JSON.stringify({ threadId, text, recipient })).digest("hex");
  const previous = await AgentSend.findOne({ userId: user.id, key: idempotencyKey }).lean();
  if (previous) {
    if (previous.bodyHash !== bodyHash) throw new ApiError(409, "This send request was already used for a different draft");
    if (previous.status === "sent") return { sent: true, messageId: previous.gmailMessageId };
    throw new ApiError(409, "Send status is uncertain. Check Gmail Sent before trying again");
  }

  const thread = await gmailRequest(user, path, { query: { format: "full" } });
  const target = replyRecipient(thread, user.email);
  if (!target || target.address.toLowerCase() !== recipient.toLowerCase()) {
    throw new ApiError(409, "The thread recipient changed. Review the conversation and draft again");
  }
  const raw = await composeReply({ from: user.email, to: target.address, subject: target.subject,
    text: text.trim(), messageId: target.messageId, references: target.references });
  try {
    await AgentSend.create({ userId: user.id, key: idempotencyKey, threadId, bodyHash, status: "sending" });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "This send request is already in progress");
    throw error;
  }
  try {
    const sent = await gmailRequest(user, "/messages/send", { method: "POST", body: { raw, threadId } });
    await AgentSend.updateOne({ userId: user.id, key: idempotencyKey }, { $set: { status: "sent", gmailMessageId: sent.id } });
    return { sent: true, messageId: sent.id };
  } catch (error) {
    await AgentSend.updateOne({ userId: user.id, key: idempotencyKey }, { $set: { status: "unknown" } });
    throw new ApiError(503, "Send status is uncertain. Check Gmail Sent before trying again");
  }
}
