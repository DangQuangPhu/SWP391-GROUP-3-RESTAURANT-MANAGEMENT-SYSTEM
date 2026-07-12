/**
 * KDS Routes — Device-based auth only (NO user JWT)
 * All routes except /activate require requireKdsDevice middleware.
 */
import express from 'express';
import { activateDevice } from '../controllers/kdsController.js';
import { getKitchenQueue, updateKitchenTicketStatus } from '../controllers/kitchenController.js';
import { requireKdsDevice } from '../middleware/kdsAuth.js';

const router = express.Router();

// ── PUBLIC (no auth) ─────────────────────────────────────────
// POST /api/kds/activate  — PIN → KDS JWT
router.post('/activate', activateDevice);

// GET /api/kds/devices-public — list device names for the PIN gate selector
// Returns only device_id + device_name (no PIN hashes, no station config)
router.get('/devices-public', async (req, res) => {
  try {
    const { getRawPool } = await import('../db.js');
    const sql = await import('mssql');
    const pool = await getRawPool();
    const result = await pool.request().query(`
      SELECT device_id, device_name
      FROM dbo.KitchenDevices
      WHERE is_active = 1
      ORDER BY device_name ASC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ success: false, data: [] });
  }
});



// ── KDS DEVICE AUTH REQUIRED ─────────────────────────────────
router.use(requireKdsDevice);

// UC-C01/C02: View kitchen queue filtered by device's station
router.get('/queue', getKitchenQueue);
router.get('/tickets', getKitchenQueue); // REST alias

// UC-C03: Update ticket status (Pending → Preparing → Ready)
router.patch('/tickets/:id/status', updateKitchenTicketStatus);

// UC-C04: Acknowledge cancellation
router.post('/tickets/:id/acknowledge-cancel', async (req, res) => {
  const { id: ticketId } = req.params;
  const { cancel_reason } = req.body;
  // KDS device actor — use device_id as actor marker (no user_id available)
  const actorId = null; // device context; AuditLog will record triggered_by='kds_device'

  if (!cancel_reason || String(cancel_reason).trim() === '') {
    return res.status(400).json({ success: false, message: 'cancel_reason is required.' });
  }

  try {
    const { getRawPool } = await import('../db.js');
    const { processTicketStatusUpdate } = await import('../controllers/kitchenController.js');
    const pool = await getRawPool();
    await processTicketStatusUpdate(pool, ticketId, 'Cancelled', 'kds_device', actorId, cancel_reason, req);
    return res.json({ success: true, message: 'Cancellation acknowledged.' });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Ticket not found.' });
    if (error.message === 'INVALID_TRANSITION_TERMINAL') return res.status(409).json({ success: false, message: 'Ticket is already in a terminal state.' });
    if (error.message === 'MISSING_CANCEL_REASON') return res.status(400).json({ success: false, message: 'cancel_reason is required.' });
    console.error('[kds.routes] acknowledge-cancel error:', error);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge cancellation.' });
  }
});

export default router;
