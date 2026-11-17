import mongoose from "mongoose";

const emailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gmailMessageId: { type: String, required: true },
  threadId: { type: String, required: true },
  from: { type: String, default: "" },
  subject: { type: String, default: "" },
  date: { type: Date, required: true },
  snippet: { type: String, default: "" },
  body: { type: String, default: "" },
  labelIds: { type: [String], default: [] },
  hasUnsubscribeHeader: { type: Boolean, default: false },
  aiCategory: { type: String, enum: ["urgent", "todo", "meeting", "newsletter", "other"], default: null },
  aiSummary: { type: String, default: null },
  classificationStatus: { type: String, enum: ["pending", "ready", "failed"], default: "pending" },
  classificationModelId: { type: String, default: null },
  classifiedAt: { type: Date, default: null },
}, { timestamps: true });

emailSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });
emailSchema.index({ userId: 1, date: -1 });
emailSchema.index({ userId: 1, threadId: 1 });

export const Email = mongoose.model("Email", emailSchema);
