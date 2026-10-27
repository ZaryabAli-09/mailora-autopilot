import { Router } from "express";
import { requireUser } from "../middlewares/require-user.js";
import { askAgent } from "../services/agent.service.js";
import { sendApprovedReply } from "../services/reply.service.js";

export const agentRouter = Router();
agentRouter.use(requireUser);
agentRouter.use((req, res, next) => req.get("X-Mailora-Request") === "1"
  ? next() : res.status(403).json({ message: "Request rejected" }));

agentRouter.post("/ask", async (req, res) => {
  res.json(await askAgent(req.user, req.body || {}));
});

agentRouter.post("/reply", async (req, res) => {
  res.json(await sendApprovedReply(req.user, req.body));
});
