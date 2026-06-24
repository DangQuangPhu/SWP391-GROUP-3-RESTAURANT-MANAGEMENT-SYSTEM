import express from "express";
import cors from "cors";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./config.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import reservationRoutes from "./routes/reservations.js";
import reservationPaymentRoutes from "./routes/reservation-payments.routes.js";
import staffRoutes from "./routes/staff.js";
import managerRoutes from "./routes/manager.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import notificationRoutes from "./routes/notifications.js";
import promotionRoutes from "./routes/promotions.js";
import voucherRoutes from "./routes/vouchers.js";
import publicRoutes from "./routes/public.js";
import { runOtpLifecycleCleanup } from "./utils/otpService.js";
import { isSmtpConfigured } from "./email.js";
import dishRoutes from "./routes/dishes.js";
import menuRoutes from "./routes/menu.routes.js";
import customerRoutes from "./routes/customer.js";
import kitchenRoutes from "./routes/kitchen.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import { initSocket } from "./socket.js";
import { runReservationReminders } from "./services/reminderService.js";
import { runAutoSeed } from "./utils/autoSeeder.js";
import { sweepNoShows } from "./services/noShowSweeper.js";
import { startCronJobs } from "./services/cronService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5001;

const allowedOrigins = (process.env.APP_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-User-Id"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
// Preflight for all routes (Express 5 requires named wildcard)
app.options("/{*path}", cors({
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-User-Id"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
app.use(express.json({ limit: "3mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/menu", (req, res, next) => {
  console.log('[Image Proxy] Incoming URL:', req.url);
  if (req.url.startsWith('/') && req.url.endsWith('.jpg') && !req.url.startsWith('/menu-')) {
    req.url = '/menu-' + req.url.slice(1);
    console.log('[Image Proxy] Rewritten URL:', req.url);
  }
  const checkPath = path.join(__dirname, "../src/assets/images/menu", req.url);
  console.log('[Image Proxy] Looking for file:', checkPath, 'Exists:', fs.existsSync(checkPath));
  next();
}, express.static(path.join(__dirname, "../src/assets/images/menu")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "phurai-api", port });
});

app.use("/api", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/reservations", reservationPaymentRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/dishes", dishRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/manager/menu", menuRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/public", publicRoutes);

import paymentRoutes from "./routes/paymentRoutes.js";
app.use("/api/payments", paymentRoutes);

app.use((req, res, next) => {
  console.log('Unmatched route hit 404 handler:', req.method, req.originalUrl);
  next();
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
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

// Run auto seed on startup
runAutoSeed();
startCronJobs();
setInterval(() => {
  runOtpLifecycleCleanup().catch((err) => {
    console.warn("OTP lifecycle cleanup:", err.message);
  });
}, OTP_CLEANUP_INTERVAL_MS);

const REMINDER_INTERVAL_MS = 15 * 60 * 1000; // 15 mins
setInterval(() => {
  runReservationReminders().catch((err) => {
    console.warn("Reservation reminder cron:", err.message);
  });
}, REMINDER_INTERVAL_MS);

const NO_SHOW_INTERVAL_MS = 60 * 1000; // 1 min
setInterval(() => {
  sweepNoShows().catch((err) => {
    console.warn("No show sweeper cron:", err.message);
  });
}, NO_SHOW_INTERVAL_MS);

const server = http.createServer(app);
const io = initSocket(server, { allowedOrigins });
app.set("io", io);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌  Port ${port} is already in use.`);
    console.error(`   Run this command to free it, then restart:\n`);
    console.error(`   kill -9 $(lsof -ti :${port}) && npm run dev:full\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Backend server listening on http://127.0.0.1:${port}`);
  console.log("SMTP configured:", isSmtpConfigured());
  console.log("Socket.IO enabled");
});

