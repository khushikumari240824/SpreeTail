// controllers/expenseController.js
import db from '../config/db.js';
import {
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
  calculateShareSplit
} from '../utils/splitCalculator.js';

// ─── Helper: compute splits map from request body ───────────────────────────
const computeSplits = (amount, split_type, participants, split_details) => {
  switch (split_type) {
    case 'equal':
      return calculateEqualSplit(amount, participants);
    case 'unequal':
      return calculateUnequalSplit(amount, split_details);
    case 'percentage':
      return calculatePercentageSplit(amount, split_details);
    case 'share':
      return calculateShareSplit(amount, split_details);
    default:
      throw new Error(`Unknown split type: ${split_type}`);
  }
};

// POST /api/expenses
export const createExpense = async (req, res) => {
  const {
    group_id, description, amount, paid_by,
    split_type, category, expense_date, notes,
    participants, split_details
  } = req.body;

  // Validate required fields
  if (!description || !amount || !paid_by || !split_type || !category || !expense_date) {
    return res.status(400).json({ message: 'Missing required fields: description, amount, paid_by, split_type, category, expense_date.' });
  }
  if (!participants || participants.length === 0) {
    return res.status(400).json({ message: 'At least one participant is required.' });
  }

  const amountCents = parseInt(amount);
  if (isNaN(amountCents) || amountCents <= 0) {
    return res.status(400).json({ message: 'Amount must be a positive integer (in cents).' });
  }

  const validSplitTypes = ['equal', 'unequal', 'percentage', 'share'];
  if (!validSplitTypes.includes(split_type)) {
    return res.status(400).json({ message: `Invalid split type. Must be one of: ${validSplitTypes.join(', ')}` });
  }

  // If group_id provided, verify requester is a member
  if (group_id) {
    const memberCheck = await db.query(
      'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [group_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this group.' });
    }
  }

  let splitsMap;
  try {
    splitsMap = computeSplits(amountCents, split_type, participants, split_details || {});
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const expResult = await client.query(
      `INSERT INTO expenses (group_id, description, amount, paid_by, split_type, category, expense_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [group_id || null, description.trim(), amountCents, paid_by, split_type, category, expense_date, notes || null]
    );
    const expense = expResult.rows[0];

    // Insert split rows
    for (const [userId, amountOwed] of Object.entries(splitsMap)) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)',
        [expense.id, userId, amountOwed]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ ...expense, splits: splitsMap });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createExpense error:', err);
    return res.status(500).json({ message: 'Server error creating expense.' });
  } finally {
    client.release();
  }
};

// GET /api/expenses/:id
export const getExpenseDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const expResult = await db.query(
      `SELECT e.*, u.name AS payer_name
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       WHERE e.id = $1`,
      [id]
    );
    if (expResult.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    const expense = expResult.rows[0];

    // Check requester has access (member of group, or is a participant in splits)
    if (expense.group_id) {
      const memberCheck = await db.query(
        'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
        [expense.group_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    } else {
      const splitCheck = await db.query(
        'SELECT 1 FROM expense_splits WHERE expense_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      const payerCheck = expense.paid_by === req.user.id;
      if (splitCheck.rows.length === 0 && !payerCheck) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }

    // Splits with user names
    const splitsResult = await db.query(
      `SELECT es.*, u.name AS user_name
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1`,
      [id]
    );

    return res.status(200).json({ ...expense, splits: splitsResult.rows });
  } catch (err) {
    console.error('getExpenseDetails error:', err);
    return res.status(500).json({ message: 'Server error fetching expense.' });
  }
};

// PUT /api/expenses/:id
export const updateExpense = async (req, res) => {
  const { id } = req.params;
  const {
    description, amount, paid_by, split_type, category, expense_date, notes,
    participants, split_details
  } = req.body;

  if (!description || !amount || !paid_by || !split_type || !category || !expense_date) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const amountCents = parseInt(amount);
  if (isNaN(amountCents) || amountCents <= 0) {
    return res.status(400).json({ message: 'Amount must be a positive integer (in cents).' });
  }

  let splitsMap;
  try {
    splitsMap = computeSplits(amountCents, split_type, participants || [], split_details || {});
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check expense exists and requester has access
    const existing = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Expense not found.' });
    }
    const expense = existing.rows[0];

    if (expense.paid_by !== req.user.id) {
      // Also allow group admins to edit
      if (expense.group_id) {
        const roleCheck = await client.query(
          "SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2",
          [expense.group_id, req.user.id]
        );
        if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: 'Only the payer or a group admin can edit this expense.' });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Only the payer can edit this expense.' });
      }
    }

    await client.query(
      `UPDATE expenses
       SET description = $1, amount = $2, paid_by = $3, split_type = $4, category = $5, expense_date = $6, notes = $7
       WHERE id = $8`,
      [description.trim(), amountCents, paid_by, split_type, category, expense_date, notes || null, id]
    );

    // Delete old splits and insert new ones
    await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [id]);
    for (const [userId, amountOwed] of Object.entries(splitsMap)) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)',
        [id, userId, amountOwed]
      );
    }

    await client.query('COMMIT');

    const updatedExp = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
    return res.status(200).json({ ...updatedExp.rows[0], splits: splitsMap });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateExpense error:', err);
    return res.status(500).json({ message: 'Server error updating expense.' });
  } finally {
    client.release();
  }
};

// DELETE /api/expenses/:id
export const deleteExpense = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    const expense = existing.rows[0];

    if (expense.paid_by !== req.user.id) {
      if (expense.group_id) {
        const roleCheck = await db.query(
          "SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2",
          [expense.group_id, req.user.id]
        );
        if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
          return res.status(403).json({ message: 'Only the payer or a group admin can delete this expense.' });
        }
      } else {
        return res.status(403).json({ message: 'Only the payer can delete this expense.' });
      }
    }

    // CASCADE from schema handles expense_splits and chat_messages
    await db.query('DELETE FROM expenses WHERE id = $1', [id]);
    return res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('deleteExpense error:', err);
    return res.status(500).json({ message: 'Server error deleting expense.' });
  }
};

// GET /api/expenses/:id/messages
export const getExpenseMessages = async (req, res) => {
  const { id } = req.params;
  try {
    // Verify expense exists and requester has access
    const expCheck = await db.query('SELECT group_id, paid_by FROM expenses WHERE id = $1', [id]);
    if (expCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    const result = await db.query(
      `SELECT cm.*, u.name AS user_name
       FROM chat_messages cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.expense_id = $1
       ORDER BY cm.created_at ASC`,
      [id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('getExpenseMessages error:', err);
    return res.status(500).json({ message: 'Server error fetching messages.' });
  }
};
