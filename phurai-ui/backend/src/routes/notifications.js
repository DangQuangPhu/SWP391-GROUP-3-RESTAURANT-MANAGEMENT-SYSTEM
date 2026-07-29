import express from "express";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(resolveUserId, requireUserId);

router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/clear-all", clearAllNotifications);
router.delete("/", clearAllNotifications);
router.delete("/:id", deleteNotification);

export default router;
