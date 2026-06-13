import db from '../config/db.js';

// ─── Helper: compute bilateral balances for a group ─────────────────────────
const helperGetGroupBalances = async (groupId) => {
  // 1. Query group members with user info
  const membersRes = await db.query(
    `SELECT u.id, u.name, u.email, gm.role, gm.joined_at
     FROM group_memberships gm
     JOIN users u ON gm.user_id = u.id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  const groupUsers = membersRes.rows;
  const groupUserIds = groupUsers.map(u => u.id);

  if (groupUserIds.length === 0) {
    return { debts: [], netBalances: {}, groupUsers: [] };
  }

  // 2. Query all expenses inside this group
  const expensesRes = await db.query(
    'SELECT id, amount, paid_by FROM expenses WHERE group_id = $1',
    [groupId]
  );
  const expenses = expensesRes.rows;

  // 3. Query all splits for these expenses
  const splitsRes = await db.query(
    `SELECT es.expense_id, es.user_id, es.amount_owed
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     WHERE e.group_id = $1`,
    [groupId]
  );
  const splits = splitsRes.rows;

  // 4. Query all settlements between members of this group
  const settlementsRes = await db.query(
    'SELECT payer_id, receiver_id, amount FROM settlements WHERE payer_id = ANY($1) AND receiver_id = ANY($1)',
    [groupUserIds]
  );
  const settlements = settlementsRes.rows;

  // Initialize ledger: ledger[debtor][creditor] = amount
  const ledger = {};
  groupUserIds.forEach(u1 => {
    ledger[u1] = {};
    groupUserIds.forEach(u2 => {
      ledger[u1][u2] = 0;
    });
  });

  const expenseMap = {};
  expenses.forEach(e => {
    expenseMap[e.id] = e;
  });

  // Calculate debts from splits
  splits.forEach(split => {
    const exp = expenseMap[split.expense_id];
    if (!exp) return;
    const paidBy = exp.paid_by;
    const debtor = split.user_id;
    if (groupUserIds.includes(debtor) && groupUserIds.includes(paidBy)) {
      if (debtor !== paidBy) {
        ledger[debtor][paidBy] = (ledger[debtor][paidBy] || 0) + split.amount_owed;
      }
    }
  });

  // Apply settlements to reduce debt
  settlements.forEach(set => {
    const p = set.payer_id;
    const r = set.receiver_id;
    if (groupUserIds.includes(p) && groupUserIds.includes(r)) {
      ledger[p][r] = (ledger[p][r] || 0) - set.amount;
    }
  });

  // Resolve bilateral debts between each pair
  const debts = [];
  const netBalances = {};
  groupUserIds.forEach(id => {
    netBalances[id] = 0;
  });

  for (let i = 0; i < groupUserIds.length; i++) {
    for (let j = i + 1; j < groupUserIds.length; j++) {
      const u1 = groupUserIds[i];
      const u2 = groupUserIds[j];

      // Net amount u1 owes u2: (what u1 owes u2) - (what u2 owes u1)
      const netOwed = (ledger[u1][u2] || 0) - (ledger[u2][u1] || 0);

      if (netOwed > 0) {
        const fromUser = groupUsers.find(u => u.id === u1);
        const toUser = groupUsers.find(u => u.id === u2);
        debts.push({
          from: u1,
          fromName: fromUser ? fromUser.name : `User ${u1}`,
          to: u2,
          toName: toUser ? toUser.name : `User ${u2}`,
          amount: netOwed
        });
        netBalances[u1] -= netOwed;
        netBalances[u2] += netOwed;
      } else if (netOwed < 0) {
        const fromUser = groupUsers.find(u => u.id === u2);
        const toUser = groupUsers.find(u => u.id === u1);
        debts.push({
          from: u2,
          fromName: fromUser ? fromUser.name : `User ${u2}`,
          to: u1,
          toName: toUser ? toUser.name : `User ${u1}`,
          amount: Math.abs(netOwed)
        });
        netBalances[u2] -= Math.abs(netOwed);
        netBalances[u1] += Math.abs(netOwed);
      }
    }
  }

  return { debts, netBalances, groupUsers };
};

// GET /api/balances/groups/:id
export const getGroupBalances = async (req, res) => {
  const groupId = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(groupId)) {
    return res.status(400).json({ message: 'Invalid group ID.' });
  }

  try {
    // Verify user is a member of the group
    const memberCheck = await db.query(
      'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    const balances = await helperGetGroupBalances(groupId);
    return res.status(200).json(balances);
  } catch (err) {
    console.error('getGroupBalances error:', err);
    return res.status(500).json({ message: 'Server error fetching group balances.' });
  }
};

// GET /api/balances/me
export const getUserBalances = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get all groups the user is a member of
    const membershipsRes = await db.query(
      'SELECT group_id FROM group_memberships WHERE user_id = $1',
      [userId]
    );
    const memberships = membershipsRes.rows;

    let totalOwed = 0; // Money others owe me
    let totalOwe = 0;  // Money I owe others
    const groupBalances = [];

    for (const membership of memberships) {
      const gId = membership.group_id;
      const { debts, netBalances } = await helperGetGroupBalances(gId);
      const userNet = netBalances[userId] || 0;

      // Sum up debts involving this user in this group
      debts.forEach(d => {
        if (d.from === userId) {
          totalOwe += d.amount;
        } else if (d.to === userId) {
          totalOwed += d.amount;
        }
      });

      groupBalances.push({
        group_id: gId,
        net: userNet
      });
    }

    const net = totalOwed - totalOwe;

    return res.status(200).json({
      net,
      totalOwed,
      totalOwe,
      groupBalances
    });
  } catch (err) {
    console.error('getUserBalances error:', err);
    return res.status(500).json({ message: 'Server error fetching user balances.' });
  }
};
