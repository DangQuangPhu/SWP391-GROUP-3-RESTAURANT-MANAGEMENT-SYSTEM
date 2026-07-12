/**
 * Admin KDS Device Management Routes
 * All routes require Admin role (requireAdmin middleware).
 */
import express from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
} from '../controllers/kdsController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

// GET  /api/admin/kds-devices      — list all devices
// POST /api/admin/kds-devices      — create a new device
router.get('/', listDevices);
router.post('/', createDevice);

// PATCH  /api/admin/kds-devices/:id — update device (name, PIN, station, is_active)
// DELETE /api/admin/kds-devices/:id — soft-delete (real-time revocation)
router.patch('/:id', updateDevice);
router.delete('/:id', deleteDevice);

export default router;
