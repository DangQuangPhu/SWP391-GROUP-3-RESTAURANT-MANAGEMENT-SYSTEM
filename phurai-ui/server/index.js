import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./config.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import { runOtpLifecycleCleanup } from "./utils/otpService.js";
import { isSmtpConfigured } from "./email.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5001;

const allowedOrigins = (process.env.APP_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
app.use(express.json({ limit: "3mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "phurai-api", port });
});

app.use("/api", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found." });
});

const distPath = path.join(__dirname, "../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

runOtpLifecycleCleanup().catch((err) => {
  console.warn("OTP lifecycle cleanup:", err.message);
});

const OTP_CLEANUP_INTERVAL_MS = 60 * 1000;
setInterval(() => {
  runOtpLifecycleCleanup().catch((err) => {
    console.warn("OTP lifecycle cleanup:", err.message);
  });
}, OTP_CLEANUP_INTERVAL_MS);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
  console.log("SMTP configured:", isSmtpConfigured());
});
