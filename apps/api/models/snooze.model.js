import mongoose from "mongoose";

const snoozeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  threadId: { type: String, required: true },
  wakeAt: { type: Date, required: true },
  nextAttemptAt: { type: Date, required: true },
  status: { type: String, enum: ["scheduled", "processing"], default: "scheduled" },
  lockedUntil: Date,
}, { timestamps: true });

snoozeSchema.index({ userId: 1, threadId: 1 }, { unique: true });
snoozeSchema.index({ status: 1, nextAttemptAt: 1 });

export const Snooze = mongoose.model("Snooze", snoozeSchema);
