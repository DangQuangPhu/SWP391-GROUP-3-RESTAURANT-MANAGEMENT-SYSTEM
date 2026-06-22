import express from 'express';
import { 
    forceSettleOrder, 
    getAreas, 
    getFilteredTables,
    getPendingReservations,
    getAllReservations,
    getReservationDetails,
    getReservationHistory,
    confirmReservation,
    rejectReservation,
    cancelReservation,
    updateReservation,
    resolveEditRequest,
    seedTestReservations,
    clearTestReservations,
    getShifts,
    getSchedules,
    assignSchedule,
    updateScheduleAttendance,
    getShiftMapping,
    updateShiftMapping
} from '../controllers/managerController.js';
import {
    createDish,
    updateDish,
    deleteDish
} from '../controllers/menuController.js';
import {
    createTable,
    getNextTableNumber,
    updateTable,
    deleteTable
} from '../controllers/tableController.js';
import {
    mergeTables,
    unmergeTable,
    getTableTimeline
} from '../controllers/tableMergeController.js';
import { purgeMockData, seedMockData } from '../controllers/mockDataController.js';
import {
    getAllPromotions,
    createPromotion,
    togglePromotionStatus,
    deletePromotion
} from '../controllers/promotionsController.js';
import { approveQrSession } from '../controllers/qrSessionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all manager routes
router.use(authMiddleware);

// Middleware to strictly restrict to Manager (4) or Admin (5)
const requireManagerOrAdmin = (req, res, next) => {
    const role = req.user?.role_id;
    if (role === 4 || role === 5) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Forbidden: Requires Manager or Admin role' });
    }
};

router.patch('/qr-sessions/:id/approve', requireManagerOrAdmin, approveQrSession);
router.post('/orders/:id/force-settle', requireManagerOrAdmin, forceSettleOrder);
router.get('/areas', requireManagerOrAdmin, getAreas);
router.get('/tables-filtered', requireManagerOrAdmin, getFilteredTables);

// Mock Data routes (Manager Only)
router.post('/mock-data/seed', requireManagerOrAdmin, seedMockData);
router.delete('/mock-data/purge', requireManagerOrAdmin, purgeMockData);

// Fallbacks for manager routes to prevent 404
router.get('/reservations/pending', requireManagerOrAdmin, getPendingReservations);
router.get('/reservations/all', requireManagerOrAdmin, getAllReservations);
router.get('/reservations/:id', requireManagerOrAdmin, getReservationDetails);
router.get('/reservations/:id/history', requireManagerOrAdmin, getReservationHistory);
router.patch('/reservations/:id/confirm', requireManagerOrAdmin, confirmReservation);
router.patch('/reservations/:id/reject', requireManagerOrAdmin, rejectReservation);
router.patch('/reservations/:id/cancel', requireManagerOrAdmin, cancelReservation);
router.patch('/reservations/:id', requireManagerOrAdmin, updateReservation);
router.post('/reservations/:id/resolve-edit', requireManagerOrAdmin, resolveEditRequest);
router.post('/reservations/seed-test', requireManagerOrAdmin, seedTestReservations);
router.delete('/reservations/clear-test', requireManagerOrAdmin, clearTestReservations);

router.get('/shifts', requireManagerOrAdmin, getShifts);
router.get('/schedules', requireManagerOrAdmin, getSchedules);
router.post('/schedules', requireManagerOrAdmin, assignSchedule);
router.patch('/schedules/:id/status', requireManagerOrAdmin, updateScheduleAttendance);

router.get('/shift-mapping', requireManagerOrAdmin, getShiftMapping);
router.put('/shift-mapping/:id', requireManagerOrAdmin, updateShiftMapping);

router.post('/tables', requireManagerOrAdmin, createTable);
router.get('/next-table-number', requireManagerOrAdmin, getNextTableNumber);
router.post('/tables/merge', requireManagerOrAdmin, mergeTables);
router.post('/tables/unmerge', requireManagerOrAdmin, unmergeTable);
router.get('/tables/:id/timeline', requireManagerOrAdmin, getTableTimeline);
router.patch('/tables/:id', requireManagerOrAdmin, updateTable);
router.delete('/tables/:id', requireManagerOrAdmin, deleteTable);

// Promotions Management
router.get('/promotions', requireManagerOrAdmin, getAllPromotions);
router.post('/promotions', requireManagerOrAdmin, createPromotion);
router.patch('/promotions/:id/toggle', requireManagerOrAdmin, togglePromotionStatus);
router.delete('/promotions/:id', requireManagerOrAdmin, deletePromotion);

export default router;
