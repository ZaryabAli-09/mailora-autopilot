import { Email } from "../models/email.model.js";
import { SyncState } from "../models/sync-state.model.js";
import { User } from "../models/user.model.js";
import { classifyEmail } from "../src/ai/nemotron.js";
import { gmailRequest } from "./gmail.service.js";
import { messageBodyText } from "./thread-presenter.js";

const active = new Set();
const maxMessages = 500;
const staleAfterMs = 15 * 60_000;

function header(message, name) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export function emailFromGmail(message) {
  if (!message?.id || !message.threadId) throw new Error("Gmail message is missing an ID");
  const date = new Date(Number(message.internalDate));
  if (!Number.isFinite(date.getTime())) throw new Error("Gmail message has an invalid date");
  return {
    gmailMessageId: message.id,
    threadId: message.threadId,
    from: header(message, "From").slice(0, 320),
    subject: header(message, "Subject").slice(0, 500),
    date,
    snippet: (message.snippet || "").slice(0, 1_000),
    body: messageBodyText(message.payload).slice(0, 12_000),
    labelIds: (message.labelIds || []).filter((label) => typeof label === "string").slice(0, 100),
    hasUnsubscribeHeader: Boolean(header(message, "List-Unsubscribe")),
  };
}

async function mapLimited(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

export async function syncUser(user) {
  const userId = user._id;
  await SyncState.updateOne({ userId }, { $set: {
    status: "syncing", total: 0, fetched: 0, classified: 0,
    classificationFailures: 0, startedAt: new Date(), error: null,
  } }, { upsert: true });
  try {
    const after = Math.floor((Date.now() - 30 * 24 * 60 * 60_000) / 1000);
    const ids = [];
    let pageToken;
    do {
      const result = await gmailRequest(user, "/messages", {
        query: { q: `after:${after}`, maxResults: Math.min(100, maxMessages - ids.length), pageToken },
      });
      ids.push(...(result.messages || []).map((item) => item.id));
      pageToken = result.nextPageToken;
    } while (pageToken && ids.length < maxMessages);
    await SyncState.updateOne({ userId }, { $set: { total: ids.length } });

    let fetched = 0;
    await mapLimited(ids, 5, async (id) => {
      try {
        const message = await gmailRequest(user, `/messages/${encodeURIComponent(id)}`, { query: { format: "full" } });
        const data = emailFromGmail(message);
        await Email.updateOne({ userId, gmailMessageId: id }, {
          $set: data,
          $setOnInsert: { classificationStatus: "pending" },
        }, { upsert: true });
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      } finally {
        fetched += 1;
        await SyncState.updateOne({ userId }, { $set: { fetched } });
      }
    });

    await SyncState.updateOne({ userId }, { $set: { status: "classifying" } });
    const pending = await Email.find({ userId, gmailMessageId: { $in: ids }, classificationStatus: { $ne: "ready" } });
    let classified = await Email.countDocuments({ userId, gmailMessageId: { $in: ids }, classificationStatus: "ready" });
    let classificationFailures = 0;
    await SyncState.updateOne({ userId }, { $set: { classified } });
    await mapLimited(pending, 2, async (email) => {
      try {
        const result = await classifyEmail(email);
        await Email.updateOne({ _id: email.id }, { $set: {
          aiCategory: result.category, aiSummary: result.summary, classificationStatus: "ready",
          classificationModelId: result.modelId, classifiedAt: new Date(),
        } });
        classified += 1;
      } catch (error) {
        classificationFailures += 1;
        await Email.updateOne({ _id: email.id }, { $set: { classificationStatus: "failed" } });
        console.error("Email classification failed", { type: error?.name || "Error", status: error?.status || null });
      }
      await SyncState.updateOne({ userId }, { $set: { classified, classificationFailures } });
    });
    await Email.deleteMany({ userId, date: { $lt: new Date(after * 1000) } });
    await SyncState.updateOne({ userId }, { $set: { status: "complete", completedAt: new Date(), error: null } });
  } catch (error) {
    console.error("Gmail sync failed", { type: error?.name || "Error", status: error?.statusCode || null });
    await SyncState.updateOne({ userId }, { $set: { status: "failed", error: error?.statusCode ? error.message : "Sync failed. Try again." } });
    throw error;
  }
}

export function queueSync(userId, { force = false } = {}) {
  const key = String(userId);
  if (active.has(key)) return;
  active.add(key);
  setImmediate(async () => {
    try {
      const state = await SyncState.findOne({ userId }).lean();
      if (!force && state?.status === "complete" && Date.now() - new Date(state.completedAt).getTime() < staleAfterMs) return;
      const user = await User.findById(userId).select("+encryptedGmailTokens");
      if (user?.encryptedGmailTokens) await syncUser(user);
    } catch (error) {
      console.error("Background sync stopped", { type: error?.name || "Error" });
    } finally { active.delete(key); }
  });
}

export function startSyncWorker() {
  async function refresh() {
    const users = await User.find({ encryptedGmailTokens: { $exists: true } }).select("_id").lean();
    users.forEach((user) => queueSync(user._id));
  }
  void refresh().catch((error) => console.error("Could not schedule Gmail sync", { type: error?.name || "Error" }));
  const timer = setInterval(() => void refresh().catch((error) => console.error("Could not schedule Gmail sync", { type: error?.name || "Error" })), staleAfterMs);
  timer.unref();
}
