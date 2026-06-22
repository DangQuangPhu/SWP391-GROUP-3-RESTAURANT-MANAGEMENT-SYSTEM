import express from "express";
import { submitQrOrderPublic } from "../controllers/qrSessionController.js";

const router = express.Router();

router.post("/qr-order/submit", submitQrOrderPublic);

export default router;
