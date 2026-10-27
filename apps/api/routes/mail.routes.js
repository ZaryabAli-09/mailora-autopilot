import { Router } from "express";
import { ApiError } from "../utils/apiError.js";
import { requireUser } from "../middlewares/require-user.js";
import { gmailRequest, threadPath } from "../services/gmail.service.js";
import { presentThread } from "../services/thread-presenter.js";
import { ThreadState } from "../models/thread-state.model.js";
import { Snooze } from "../models/snooze.model.js";
import { Email } from "../models/email.model.js";
import { SyncState } from "../models/sync-state.model.js";
import { queueSync } from "../services/sync.service.js";

export const mailRouter = Router();
mailRouter.use(requireUser);
mailRouter.use((req, res, next) => {
  if (req.method !== "GET" && req.get("X-Mailora-Request") !== "1") {
    return res.status(403).json({ message: "Request rejected" });
  }
  next();
});

mailRouter.get("/inbox", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : "";
  const view = typeof req.query.view === "string" ? req.query.view : "all";
  if (search.length > 200 || !/^(?:0|[1-9]\d{0,3})?$/.test(cursor) || !["all", "urgent", "todo", "meeting", "newsletter"].includes(view)) {
    throw new ApiError(400, "Invalid inbox filter");
  }
  const [emails, sync] = await Promise.all([
    Email.find({ userId: req.user.id, labelIds: "INBOX", date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) } }).select("-body").sort({ date: -1 }).limit(500).lean(),
    SyncState.findOne({ userId: req.user.id }).lean(),
  ]);
  if (!sync || (sync.status === "complete" && Date.now() - new Date(sync.completedAt).getTime() > 15 * 60_000)) queueSync(req.user.id);
  const groups = new Map();
  for (const email of emails) {
    if (!groups.has(email.threadId)) groups.set(email.threadId, []);
    groups.get(email.threadId).push(email);
  }
  const ids = [...groups.keys()];
  const states = await ThreadState.find({ userId: req.user.id, threadId: { $in: ids }, pinned: true }).lean();
  const pinnedIds = new Set(states.map((state) => state.threadId));
  const threads = [...groups.entries()].map(([id, messages]) => {
    const latest = messages[0];
    const labels = new Set(messages.flatMap((message) => message.labelIds));
    return {
      id,
      subject: latest.subject || "(no subject)", sender: latest.from || "Unknown sender",
      snippet: latest.classificationStatus === "ready" ? latest.aiSummary : latest.snippet,
      lastMessageAt: latest.date.toISOString(), messageCount: messages.length,
      unread: labels.has("UNREAD"), important: labels.has("IMPORTANT"), pinned: pinnedIds.has(id),
      category: labels.has("CATEGORY_PROMOTIONS") ? "promotions" : labels.has("CATEGORY_UPDATES") ? "updates" : "focused",
      aiCategory: latest.classificationStatus === "ready" ? latest.aiCategory : null,
      classificationStatus: latest.classificationStatus,
    };
  }).filter((thread) => (view === "all" || thread.aiCategory === view) &&
    (!search || `${thread.sender} ${thread.subject} ${thread.snippet}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  const offset = Number(cursor || 0);
  const page = threads.slice(offset, offset + 25);
  res.json({
    threads: page,
    nextCursor: offset + 25 < threads.length ? String(offset + 25) : null,
    sync: sync ? { status: sync.status, total: sync.total, fetched: sync.fetched, classified: sync.classified,
      classificationFailures: sync.classificationFailures, error: sync.error || null } :
      { status: "queued", total: 0, fetched: 0, classified: 0, classificationFailures: 0, error: null },
  });
});

mailRouter.post("/sync", async (req, res) => {
  await SyncState.updateOne({ userId: req.user.id }, { $set: { status: "queued", error: null } }, { upsert: true });
  queueSync(req.user.id, { force: true });
  res.status(202).json({ queued: true });
});

mailRouter.get("/threads/:id", async (req, res) => {
  const path = threadPath(req.params.id);
  const [thread, state] = await Promise.all([
    gmailRequest(req.user, path, { query: { format: "full" } }),
    ThreadState.findOne({ userId: req.user.id, threadId: req.params.id }).lean(),
  ]);
  res.json({ thread: presentThread(thread, { pinned: Boolean(state?.pinned) }) });
});

mailRouter.post("/threads/:id/done", async (req, res) => {
  const path = threadPath(req.params.id);
  await gmailRequest(req.user, `${path}/modify`, { method: "POST", body: { removeLabelIds: ["INBOX"] } });
  await Email.updateMany({ userId: req.user.id, threadId: req.params.id }, { $pull: { labelIds: "INBOX" } });
  await Snooze.deleteOne({ userId: req.user.id, threadId: req.params.id });
  res.json({ done: true });
});

mailRouter.put("/threads/:id/pin", async (req, res) => {
  const path = threadPath(req.params.id);
  if (typeof req.body?.pinned !== "boolean") throw new ApiError(400, "pinned must be a boolean");
  await gmailRequest(req.user, path, { query: { format: "minimal" } });
  if (req.body.pinned) {
    await ThreadState.updateOne(
      { userId: req.user.id, threadId: req.params.id },
      { $set: { pinned: true } },
      { upsert: true },
    );
  } else {
    await ThreadState.deleteOne({ userId: req.user.id, threadId: req.params.id });
  }
  res.json({ pinned: req.body.pinned });
});

mailRouter.post("/threads/:id/snooze", async (req, res) => {
  const path = threadPath(req.params.id);
  const until = new Date(req.body?.until);
  if (!Number.isFinite(until.getTime()) || until.getTime() < Date.now() + 60_000 || until.getTime() > Date.now() + 365 * 24 * 60 * 60_000) {
    throw new ApiError(400, "Choose a future time within one year");
  }
  const thread = await gmailRequest(req.user, path, { query: { format: "metadata" } });
  if (!(thread.messages || []).some((message) => message.labelIds?.includes("INBOX"))) {
    throw new ApiError(409, "This thread is no longer in your inbox");
  }
  try {
    await Snooze.create({ userId: req.user.id, threadId: req.params.id, wakeAt: until, nextAttemptAt: until });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "This thread is already snoozed");
    throw error;
  }
  try {
    await gmailRequest(req.user, `${path}/modify`, { method: "POST", body: { removeLabelIds: ["INBOX"] } });
    await Email.updateMany({ userId: req.user.id, threadId: req.params.id }, { $pull: { labelIds: "INBOX" } });
  } catch (error) {
    await Snooze.deleteOne({ userId: req.user.id, threadId: req.params.id });
    throw error;
  }
  res.json({ snoozedUntil: until.toISOString() });
});
