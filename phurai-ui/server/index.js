import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./config.js";
import authRoutes from "./routes/auth.js";
import { runMigrationsOnStartup } from "./utils/authDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5001;

const allowedOrigins = (process.env.APP_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "3mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "phurai-api", port });
});

app.use("/api", authRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found." });
});

runMigrationsOnStartup().catch((err) => {
  console.warn("Startup migrations:", err.message);
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
