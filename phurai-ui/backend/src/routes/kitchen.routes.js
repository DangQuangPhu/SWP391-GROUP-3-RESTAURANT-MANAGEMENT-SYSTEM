import express from 'express';
import { getKitchenQueue, updateKitchenTicketStatus } from '../controllers/kitchenController.js';
import { authMiddleware, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// Staff-side KDS view (user JWT required — role_id=2,4,5)
// KDS device access is via /api/kds/* using requireKdsDevice
router.use(authMiddleware);
router.use(requireStaff);


// UC-C01/C02: View kitchen queue (FIFO, includes notes)
router.get('/queue', getKitchenQueue);
router.get('/tickets', getKitchenQueue); // REST-compliant alias

// UC-C03: Update ticket status (Pending → Preparing → Ready)
router.patch('/tickets/:id/status', updateKitchenTicketStatus);

// UC-C04: Kitchen staff acknowledge/confirm a cancellation request
// Sets kitchen_status = 'Cancelled' using the same processTicketStatusUpdate logic.
router.post('/tickets/:id/acknowledge-cancel', async (req, res) => {
    const { id: ticketId } = req.params;
    const { cancel_reason } = req.body;
    const actorId = req.user?.user_id;

    if (!cancel_reason || String(cancel_reason).trim() === '') {
        return res.status(400).json({ success: false, message: 'cancel_reason is required for cancellation.' });
    }

    try {
        const { getRawPool } = await import('../db.js');
        const { processTicketStatusUpdate } = await import('../controllers/kitchenController.js');
        const pool = await getRawPool();
        await processTicketStatusUpdate(pool, ticketId, 'Cancelled', 'kitchen_staff', actorId, cancel_reason, req);
        return res.json({ success: true, message: 'Cancellation acknowledged. Ticket marked as Cancelled.' });
    } catch (error) {
        if (error.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (error.message === 'INVALID_TRANSITION_TERMINAL') return res.status(409).json({ success: false, message: 'Ticket is already in a terminal state.' });
        if (error.message === 'MISSING_CANCEL_REASON') return res.status(400).json({ success: false, message: 'cancel_reason is required.' });
        console.error('[kitchen.routes] acknowledge-cancel error:', error);
        return res.status(500).json({ success: false, message: 'Failed to acknowledge cancellation.', error: error.message });
    }
});

export default router;
