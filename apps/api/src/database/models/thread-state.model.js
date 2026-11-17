import mongoose from "mongoose";

const threadStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  threadId: { type: String, required: true },
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

threadStateSchema.index({ userId: 1, threadId: 1 }, { unique: true });

export const ThreadState = mongoose.model("ThreadState", threadStateSchema);
