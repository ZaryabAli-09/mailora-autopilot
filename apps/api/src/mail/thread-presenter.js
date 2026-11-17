import { convert } from "html-to-text";

function header(message, name) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBody(data) {
  if (!data) return "";
  try { return Buffer.from(data, "base64url").toString("utf8"); } catch { return ""; }
}

export function messageBodyText(payload) {
  const plain = [];
  const html = [];
  function visit(part) {
    if (part.filename) return;
    if (part.mimeType === "text/plain") plain.push(decodeBody(part.body?.data));
    else if (part.mimeType === "text/html") html.push(decodeBody(part.body?.data));
    for (const child of part.parts || []) visit(child);
  }
  if (payload) visit(payload);
  const result = plain.filter(Boolean).join("\n\n") || convert(html.filter(Boolean).join("\n"), { wordwrap: false });
  return result.slice(0, 150_000);
}

function labelsFor(thread) {
  return new Set((thread.messages || []).flatMap((message) => message.labelIds || []));
}

export function presentSummary(thread, { pinned = false } = {}) {
  const messages = thread.messages || [];
  const latest = messages.at(-1) || {};
  const labels = labelsFor(thread);
  const category = labels.has("CATEGORY_PROMOTIONS") ? "promotions" :
    labels.has("CATEGORY_UPDATES") ? "updates" : "focused";
  return {
    id: thread.id,
    subject: header(latest, "Subject") || header(messages[0] || {}, "Subject") || "(no subject)",
    sender: header(latest, "From") || "Unknown sender",
    snippet: thread.snippet || latest.snippet || "",
    lastMessageAt: new Date(Number(latest.internalDate || Date.now())).toISOString(),
    messageCount: messages.length,
    unread: labels.has("UNREAD"),
    important: labels.has("IMPORTANT"),
    pinned,
    category,
  };
}

export function presentThread(thread, { pinned = false } = {}) {
  return {
    ...presentSummary(thread, { pinned }),
    messages: (thread.messages || []).map((message) => ({
      id: message.id,
      from: header(message, "From"),
      to: header(message, "To"),
      date: new Date(Number(message.internalDate || Date.now())).toISOString(),
      body: messageBodyText(message.payload),
    })),
  };
}
