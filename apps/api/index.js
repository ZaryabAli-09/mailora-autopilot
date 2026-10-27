import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { connectDB } from "./configs/dbConnection.js";
import { authRouter } from "./routes/auth.routes.js";
import { mailRouter } from "./routes/mail.routes.js";
import { agentRouter } from "./routes/agent.routes.js";
import { startSnoozeWorker } from "./services/snooze-worker.js";
import { startSyncWorker } from "./services/sync.service.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();
const port = Number(process.env.PORT || 8000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true, methods: ["GET", "POST", "PUT"], allowedHeaders: ["Content-Type", "X-Mailora-Request"] }));
app.use(compression());
morgan.token("safe-path", (req) => req.path);
app.use(morgan(":method :safe-path :status :response-time ms"));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/auth", authRouter);
app.use("/api/agent", agentRouter);
app.use("/api", mailRouter);
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorMiddleware);

if (process.env.NODE_ENV !== "test") {
  try {
    await connectDB();
    startSnoozeWorker();
    startSyncWorker();
    app.listen(port, () => console.log(`Mailora API listening on ${port}`));
  } catch (error) {
    console.error("API startup failed:", error);
    process.exit(1);
  }
}

export { app };
