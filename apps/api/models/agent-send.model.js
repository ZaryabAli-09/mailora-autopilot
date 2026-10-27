import mongoose from "mongoose";

const agentSendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  key: { type: String, required: true },
  threadId: { type: String, required: true },
  bodyHash: { type: String, required: true },
  status: { type: String, enum: ["sending", "sent", "unknown"], required: true },
  gmailMessageId: String,
}, { timestamps: true });

agentSendSchema.index({ userId: 1, key: 1 }, { unique: true });

export const AgentSend = mongoose.model("AgentSend", agentSendSchema);
