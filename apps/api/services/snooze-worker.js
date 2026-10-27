import { Snooze } from "../models/snooze.model.js";
import { User } from "../models/user.model.js";
import { Email } from "../models/email.model.js";
import { gmailRequest, threadPath } from "./gmail.service.js";

let running = false;

export async function processDueSnoozes() {
  if (running) return;
  running = true;
  try {
    for (let processed = 0; processed < 20; processed += 1) {
      const now = new Date();
      const snooze = await Snooze.findOneAndUpdate(
        { $or: [
          { status: "scheduled", nextAttemptAt: { $lte: now } },
          { status: "processing", lockedUntil: { $lte: now } },
        ] },
        { $set: { status: "processing", lockedUntil: new Date(now.getTime() + 2 * 60_000) } },
        { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
      );
      if (!snooze) break;
      try {
        const user = await User.findById(snooze.userId).select("+encryptedGmailTokens");
        if (!user) {
          await snooze.deleteOne();
          continue;
        }
        await gmailRequest(user, `${threadPath(snooze.threadId)}/modify`, {
          method: "POST",
          body: { addLabelIds: ["INBOX"] },
        });
        await Email.updateMany({ userId: snooze.userId, threadId: snooze.threadId }, { $addToSet: { labelIds: "INBOX" } });
        await snooze.deleteOne();
      } catch (error) {
        if (error.statusCode === 404) {
          await snooze.deleteOne();
          continue;
        }
        console.error("Could not wake a snoozed thread", { id: String(snooze.id), statusCode: error.statusCode || 500 });
        snooze.status = "scheduled";
        snooze.lockedUntil = undefined;
        snooze.nextAttemptAt = new Date(Date.now() + 60_000);
        await snooze.save();
      }
    }
  } finally {
    running = false;
  }
}

export function startSnoozeWorker() {
  processDueSnoozes().catch((error) => console.error("Snooze worker failed", error));
  const interval = setInterval(() => {
    processDueSnoozes().catch((error) => console.error("Snooze worker failed", error));
  }, 30_000);
  interval.unref();
}
