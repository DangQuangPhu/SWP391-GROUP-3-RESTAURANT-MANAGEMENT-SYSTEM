import express from "express";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(resolveUserId, requireUserId);

router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

export default router;
