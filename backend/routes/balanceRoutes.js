import express from 'express';
import { getGroupBalances, getUserBalances } from '../controllers/balanceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Protect all balance routes

router.get('/groups/:id', getGroupBalances);
router.get('/me', getUserBalances);

export default router;
