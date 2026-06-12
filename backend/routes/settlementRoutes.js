import express from 'express';
import { recordSettlement, listSettlements } from '../controllers/settlementController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Protect all settlement routes

router.post('/', recordSettlement);
router.get('/', listSettlements);

export default router;
