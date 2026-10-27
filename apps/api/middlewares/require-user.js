import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export async function requireUser(req, res, next) {
  try {
    const token = req.cookies?.mailora_session;
    if (!token || !process.env.JWT_SECRET) return res.status(401).json({ message: "Not signed in" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("+encryptedGmailTokens");
    if (!user) return res.status(401).json({ message: "Not signed in" });
    req.user = user;
    res.set("Cache-Control", "no-store");
    next();
  } catch {
    res.status(401).json({ message: "Not signed in" });
  }
}
