import express from 'express';
import {
  createExpense,
  getExpenseDetails,
  updateExpense,
  deleteExpense,
  getExpenseMessages
} from '../controllers/expenseController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Protect all expense routes

router.post('/', createExpense);
router.get('/:id', getExpenseDetails);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

// Chat / comments on expense
router.get('/:id/messages', getExpenseMessages);

export default router;
