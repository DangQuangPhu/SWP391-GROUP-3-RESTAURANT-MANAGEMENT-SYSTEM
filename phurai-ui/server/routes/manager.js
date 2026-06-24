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
  updateTable,
  deleteTable,
  getNextTableNumber,
  listFilteredTables,
} from "../controllers/tableController.js";
import { mergeTables, unmergeTable, getTableTimeline } from "../controllers/tableMergeController.js";
import {
  getStaffShiftMapping,
  putStaffShiftMapping,
} from "../controllers/shiftMappingController.js";
import {
  getPendingReservations,
  getAllReservations,
  getReservationDetails,
  confirmReservation,
  rejectReservation,
  cancelReservation,
  updateReservation,
  getReservationHistory,
  seedTestReservations,
  clearTestReservations,
  resolveEditRequest,
} from "../controllers/managerReservationController.js";
import {
  getAllPromotions,
  createPromotion,
  togglePromotionStatus,
  deletePromotion,
} from "../controllers/promotionsController.js";
import {
  resolveCancelRequest,
} from "../services/resolveRequestService.js";

const router = express.Router();

router.use(resolveUserId, requireUserId, requireManager);

// Promotions
router.get("/promotions", getAllPromotions);
router.post("/promotions", createPromotion);
router.patch("/promotions/:id/toggle", togglePromotionStatus);
router.delete("/promotions/:id", deletePromotion);

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
router.patch("/tables/:id", updateTable);
router.delete("/tables/:id", deleteTable);
router.post("/tables/merge", mergeTables);
router.post("/tables/unmerge", unmergeTable);
router.get("/tables/:tableId/timeline", getTableTimeline);

// Floor Plan Config
import { getFloorPlanData } from "../controllers/floorPlanController.js";
router.get("/floor-plan", getFloorPlanData);

// Reservations
router.get("/reservations/pending", getPendingReservations);
router.get("/reservations/all", getAllReservations);
router.post("/reservations/seed-test", seedTestReservations);  // Must be BEFORE /:id
router.delete("/reservations/clear-test", clearTestReservations);
router.get("/reservations/:id", getReservationDetails);
router.get("/reservations/:id/history", getReservationHistory);
router.patch("/reservations/:id/confirm", confirmReservation);
router.patch("/reservations/:id/reject", rejectReservation);
router.patch("/reservations/:id/cancel", cancelReservation);

// Flow C — resolve pending edit request (Path B from Audit)
router.post("/reservations/:id/resolve-edit", resolveEditRequest);

router.patch("/reservations/:id/resolve-cancel", async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation ID." });
  }
  const managerId = Number(req.userId);
  const { decision } = req.body || {};
  if (!decision) {
    return res.status(400).json({
      success: false,
      message: "Body must include 'decision': 'process' or 'reject'.",
    });
  }
  try {
    const result = await resolveCancelRequest(reservationId, managerId, decision, req.ip);
    if (!result.success) {
      const statusMap = {
        NOT_FOUND: 404, FORBIDDEN: 403,
        NO_PENDING_CANCEL_REQUEST: 409, INVALID_DECISION: 400,
      };
      return res.status(statusMap[result.code] || 400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("[PATCH /reservations/:id/resolve-cancel]", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

router.patch("/reservations/:id", updateReservation);

export default router;
