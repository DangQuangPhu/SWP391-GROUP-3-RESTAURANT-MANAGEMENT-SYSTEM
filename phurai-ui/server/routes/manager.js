import express from "express";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { requireManager } from "../middleware/managerMiddleware.js";
import {
  listShifts,
  listSchedules,
  createSchedule,
  updateScheduleStatus,
} from "../controllers/scheduleController.js";
import { listAreas, createTable, getNextTableNumber, listFilteredTables } from "../controllers/tableController.js";

const router = express.Router();

router.use(resolveUserId, requireUserId, requireManager);

router.get("/shifts", listShifts);
router.get("/schedules", listSchedules);
router.post("/schedules", createSchedule);
router.patch("/schedules/:id/status", updateScheduleStatus);

router.get("/areas", listAreas);
router.get("/next-table-number", getNextTableNumber);
router.get("/tables-filtered", listFilteredTables);
router.post("/tables", createTable);

export default router;
