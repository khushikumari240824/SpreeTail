// controllers/groupController.js
import db from '../config/db.js';

// ─── Helper: assert user is a member of a group ─────────────────────────────
const assertMember = async (groupId, userId) => {
  const res = await db.query(
    'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  if (res.rows.length === 0) throw new Error('FORBIDDEN');
  return res.rows[0].role;
};

// POST /api/groups
export const createGroup = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Group name is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const groupResult = await client.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name.trim(), req.user.id]
    );
    const group = groupResult.rows[0];

    // Creator becomes admin member automatically
    await client.query(
      'INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, $3)',
      [group.id, req.user.id, 'admin']
    );

    await client.query('COMMIT');
    return res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createGroup error:', err);
    return res.status(500).json({ message: 'Server error creating group.' });
  } finally {
    client.release();
  }
};

// GET /api/groups
export const listGroups = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*
       FROM groups g
       JOIN group_memberships gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('listGroups error:', err);
    return res.status(500).json({ message: 'Server error listing groups.' });
  }
};

// GET /api/groups/:id
export const getGroupDetails = async (req, res) => {
  const { id } = req.params;
  try {
    // Verify membership
    const memberCheck = await db.query(
      'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Not a member of this group.' });
    }

    const groupResult = await db.query('SELECT * FROM groups WHERE id = $1', [id]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Members with user info
    const membersResult = await db.query(
      `SELECT gm.user_id, gm.role, gm.joined_at, u.name, u.email
       FROM group_memberships gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [id]
    );

    // Expenses for this group
    const expensesResult = await db.query(
      `SELECT e.*, u.name AS payer_name
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       WHERE e.group_id = $1
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [id]
    );

    return res.status(200).json({
      ...groupResult.rows[0],
      members: membersResult.rows,
      expenses: expensesResult.rows
    });
  } catch (err) {
    console.error('getGroupDetails error:', err);
    return res.status(500).json({ message: 'Server error fetching group.' });
  }
};

// PUT /api/groups/:id
export const updateGroup = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Group name is required.' });
  }

  try {
    const role = await assertMember(id, req.user.id).catch(() => null);
    if (!role) return res.status(403).json({ message: 'Not a member of this group.' });
    if (role !== 'admin') return res.status(403).json({ message: 'Only admins can update the group name.' });

    const result = await db.query(
      'UPDATE groups SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Group not found.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('updateGroup error:', err);
    return res.status(500).json({ message: 'Server error updating group.' });
  }
};

// DELETE /api/groups/:id
export const deleteGroup = async (req, res) => {
  const { id } = req.params;
  try {
    const role = await assertMember(id, req.user.id).catch(() => null);
    if (!role) return res.status(403).json({ message: 'Not a member of this group.' });
    if (role !== 'admin') return res.status(403).json({ message: 'Only admins can delete a group.' });

    // Check for unsettled balances
    const debtCheck = await db.query(
      `SELECT
         es.user_id AS debtor,
         e.paid_by AS creditor,
         SUM(es.amount_owed) AS total_owed
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.group_id = $1
         AND es.user_id != e.paid_by
       GROUP BY es.user_id, e.paid_by`,
      [id]
    );

    const settlementCheck = await db.query(
      `SELECT payer_id, receiver_id, SUM(amount) AS total_paid
       FROM settlements
       WHERE payer_id IN (
         SELECT user_id FROM group_memberships WHERE group_id = $1
       )
       AND receiver_id IN (
         SELECT user_id FROM group_memberships WHERE group_id = $1
       )
       GROUP BY payer_id, receiver_id`,
      [id]
    );

    // Build ledger to check for outstanding balances
    const ledger = {};
    debtCheck.rows.forEach(row => {
      const key = `${row.debtor}_${row.creditor}`;
      ledger[key] = (ledger[key] || 0) + parseInt(row.total_owed);
    });
    settlementCheck.rows.forEach(row => {
      const key = `${row.payer_id}_${row.receiver_id}`;
      ledger[key] = (ledger[key] || 0) - parseInt(row.total_paid);
    });

    const hasOutstanding = Object.values(ledger).some(v => v > 0);
    if (hasOutstanding) {
      return res.status(400).json({ message: 'Cannot delete group with unsettled balances. Please settle all debts first.' });
    }

    await db.query('DELETE FROM groups WHERE id = $1', [id]);
    return res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (err) {
    console.error('deleteGroup error:', err);
    return res.status(500).json({ message: 'Server error deleting group.' });
  }
};

// POST /api/groups/:id/invite
export const inviteUser = async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    // Inviter must be a member
    const role = await assertMember(id, req.user.id).catch(() => null);
    if (!role) return res.status(403).json({ message: 'Not a member of this group.' });

    // Find invitee
    const userResult = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: `No account found for email: ${email}` });
    }
    const invitee = userResult.rows[0];

    // Check already a member
    const alreadyMember = await db.query(
      'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [id, invitee.id]
    );
    if (alreadyMember.rows.length > 0) {
      return res.status(409).json({ message: `${invitee.name} is already a member of this group.` });
    }

    // Check for pending invite
    const pendingInvite = await db.query(
      'SELECT 1 FROM group_invitations WHERE group_id = $1 AND invited_user_id = $2 AND status = $3',
      [id, invitee.id, 'pending']
    );
    if (pendingInvite.rows.length > 0) {
      return res.status(409).json({ message: `A pending invitation already exists for ${invitee.email}.` });
    }

    const inviteResult = await db.query(
      'INSERT INTO group_invitations (group_id, invited_user_id, invited_by) VALUES ($1, $2, $3) RETURNING *',
      [id, invitee.id, req.user.id]
    );

    return res.status(201).json({
      message: 'Invitation sent successfully.',
      invitation: inviteResult.rows[0]
    });
  } catch (err) {
    console.error('inviteUser error:', err);
    return res.status(500).json({ message: 'Server error sending invitation.' });
  }
};

// GET /api/groups/invitations/pending
export const listPendingInvitations = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT gi.*, g.name AS group_name, u.name AS invited_by_name
       FROM group_invitations gi
       JOIN groups g ON gi.group_id = g.id
       JOIN users u ON gi.invited_by = u.id
       WHERE gi.invited_user_id = $1 AND gi.status = 'pending'
       ORDER BY gi.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('listPendingInvitations error:', err);
    return res.status(500).json({ message: 'Server error listing invitations.' });
  }
};

// POST /api/groups/invitations/:id/accept
export const acceptInvitation = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const invResult = await client.query(
      'SELECT * FROM group_invitations WHERE id = $1 AND invited_user_id = $2 AND status = $3',
      [id, req.user.id, 'pending']
    );
    if (invResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invitation not found or already resolved.' });
    }

    const invite = invResult.rows[0];

    await client.query(
      "UPDATE group_invitations SET status = 'accepted' WHERE id = $1",
      [id]
    );
    await client.query(
      "INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [invite.group_id, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Invitation accepted. You are now a member of the group.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('acceptInvitation error:', err);
    return res.status(500).json({ message: 'Server error accepting invitation.' });
  } finally {
    client.release();
  }
};

// POST /api/groups/invitations/:id/reject
export const rejectInvitation = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      "UPDATE group_invitations SET status = 'rejected' WHERE id = $1 AND invited_user_id = $2 AND status = 'pending' RETURNING id",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invitation not found or already resolved.' });
    }
    return res.status(200).json({ message: 'Invitation rejected.' });
  } catch (err) {
    console.error('rejectInvitation error:', err);
    return res.status(500).json({ message: 'Server error rejecting invitation.' });
  }
};
