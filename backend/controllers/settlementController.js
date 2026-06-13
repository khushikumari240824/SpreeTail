// controllers/settlementController.js
import db from '../config/db.js';

// POST /api/settlements
export const recordSettlement = async (req, res) => {
  const { payer_id, receiver_id, amount, settlement_date, notes } = req.body;

  if (!payer_id || !receiver_id || !amount || !settlement_date) {
    return res.status(400).json({ message: 'payer_id, receiver_id, amount, and settlement_date are required.' });
  }

  const amountCents = parseInt(amount);
  if (isNaN(amountCents) || amountCents <= 0) {
    return res.status(400).json({ message: 'Amount must be a positive integer (in cents).' });
  }

  if (parseInt(payer_id) === parseInt(receiver_id)) {
    return res.status(400).json({ message: 'Payer and receiver must be different users.' });
  }

  // Only allow if the requester is the payer
  if (req.user.id !== parseInt(payer_id)) {
    return res.status(403).json({ message: 'You can only record settlements where you are the payer.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO settlements (payer_id, receiver_id, amount, settlement_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [payer_id, receiver_id, amountCents, settlement_date, notes || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('recordSettlement error:', err);
    return res.status(500).json({ message: 'Server error recording settlement.' });
  }
};

// GET /api/settlements
export const listSettlements = async (req, res) => {
  try {
    // Return settlements where the current user is either payer or receiver
    const result = await db.query(
      `SELECT s.*,
              p.name AS payer_name,
              r.name AS receiver_name
       FROM settlements s
       JOIN users p ON s.payer_id = p.id
       JOIN users r ON s.receiver_id = r.id
       WHERE s.payer_id = $1 OR s.receiver_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('listSettlements error:', err);
    return res.status(500).json({ message: 'Server error listing settlements.' });
  }
};
