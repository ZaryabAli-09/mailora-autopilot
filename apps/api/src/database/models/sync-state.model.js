import mongoose from "mongoose";

const syncStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  status: { type: String, enum: ["queued", "syncing", "classifying", "complete", "failed"], default: "queued" },
  total: { type: Number, default: 0 },
  fetched: { type: Number, default: 0 },
  classified: { type: Number, default: 0 },
  classificationFailures: { type: Number, default: 0 },
  startedAt: Date,
  completedAt: Date,
  error: String,
}, { timestamps: true });

export const SyncState = mongoose.model("SyncState", syncStateSchema);
