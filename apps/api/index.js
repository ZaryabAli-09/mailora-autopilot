import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { connectDB } from "./configs/dbConnection.js";
import { authRouter } from "./routes/auth.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();
const port = Number(process.env.PORT || 8000);
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true, methods: ["GET", "POST"] }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/auth", authRouter);
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorMiddleware);

if (process.env.NODE_ENV !== "test") {
  try {
    await connectDB();
    app.listen(port, () => console.log(`Mailora API listening on ${port}`));
  } catch (error) {
    console.error("API startup failed:", error);
    process.exit(1);
  }
}

export { app };
