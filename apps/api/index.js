import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (_request, response) => {
  response.json({ message: "Main service is running" });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Main service listening on port ${port}`);
  });
}

export default app;