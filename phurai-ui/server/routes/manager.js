import express from "express";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { requireManager } from "../middleware/managerMiddleware.js";
import {
  listShifts,
  listSchedules,
  createSchedule,
  updateScheduleStatus,
} from "../controllers/scheduleController.js";
import {
  listAreas,
  createTable,
  getNextTableNumber,
  listFilteredTables,
} from "../controllers/tableController.js";
import {
  getStaffShiftMapping,
  putStaffShiftMapping,
} from "../controllers/shiftMappingController.js";
import {
  getPendingReservations,
  getAllReservations,
  confirmReservation,
  getReservationHistory,
  rejectReservation,
  cancelReservation
} from "../controllers/managerReservationController.js";

const router = express.Router();

router.use(resolveUserId, requireUserId, requireManager);

router.get("/shifts", listShifts);
router.get("/shift-mapping", getStaffShiftMapping);
router.put("/shift-mapping/:staffId", putStaffShiftMapping);
router.put("/shifts/:staffId", putStaffShiftMapping);
router.get("/schedules", listSchedules);
router.post("/schedules", createSchedule);
router.patch("/schedules/:id/status", updateScheduleStatus);

router.get("/areas", listAreas);
router.get("/next-table-number", getNextTableNumber);
router.get("/tables-filtered", listFilteredTables);
router.post("/tables", createTable);

// Reservations
router.get("/reservations/pending", getPendingReservations);
router.get("/reservations/all", getAllReservations);
router.patch("/reservations/:id/confirm", confirmReservation);
router.patch("/reservations/:id/reject", rejectReservation);
router.patch("/reservations/:id/cancel", cancelReservation);
router.get("/reservations/:id/history", getReservationHistory);

export default router;
