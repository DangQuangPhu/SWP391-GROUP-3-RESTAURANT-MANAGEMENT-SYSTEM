import express from 'express';
import { getKitchenQueue, updateKitchenTicketStatus } from '../controllers/kitchenController.js';
import { authMiddleware, requireStaffOrKitchen } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireStaffOrKitchen);

router.get('/queue', getKitchenQueue);
router.patch('/tickets/:id/status', updateKitchenTicketStatus);

export default router;
