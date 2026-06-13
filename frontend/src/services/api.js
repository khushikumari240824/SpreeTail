// src/services/api.js
import axios from 'axios';

// Toggle between mock and real API mode
export const USE_MOCK = true;

const API_BASE_URL = 'http://localhost:5000/api';

// Configure axios client for real mode
const httpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==========================================
// LOCAL STORAGE MOCK DATABASE INITIALIZER
// ==========================================
const initMockDB = () => {
  if (!localStorage.getItem('st_users')) {
    // Seed initial users
    const defaultUsers = [
      { id: 1, name: 'Alice Smith', email: 'alice@example.com', password_hash: 'hashed' },
      { id: 2, name: 'Bob Johnson', email: 'bob@example.com', password_hash: 'hashed' },
      { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', password_hash: 'hashed' },
      { id: 4, name: 'Diana Prince', email: 'diana@example.com', password_hash: 'hashed' }
    ];
    localStorage.setItem('st_users', JSON.stringify(defaultUsers));
  }
  if (!localStorage.getItem('st_groups')) {
    const defaultGroups = [
      { id: 1, name: 'Roomies 2026', created_by: 1, created_at: new Date().toISOString() },
      { id: 2, name: 'Road Trip to LA', created_by: 2, created_at: new Date().toISOString() }
    ];
    localStorage.setItem('st_groups', JSON.stringify(defaultGroups));
  }
  if (!localStorage.getItem('st_memberships')) {
    const defaultMemberships = [
      // Group 1: Alice, Bob, Charlie
      { id: 1, group_id: 1, user_id: 1, role: 'admin', joined_at: new Date().toISOString() },
      { id: 2, group_id: 1, user_id: 2, role: 'member', joined_at: new Date().toISOString() },
      { id: 3, group_id: 1, user_id: 3, role: 'member', joined_at: new Date().toISOString() },
      // Group 2: Bob, Charlie, Diana
      { id: 4, group_id: 2, user_id: 2, role: 'admin', joined_at: new Date().toISOString() },
      { id: 5, group_id: 2, user_id: 3, role: 'member', joined_at: new Date().toISOString() },
      { id: 6, group_id: 2, user_id: 4, role: 'member', joined_at: new Date().toISOString() }
    ];
    localStorage.setItem('st_memberships', JSON.stringify(defaultMemberships));
  }
  if (!localStorage.getItem('st_invitations')) {
    const defaultInvitations = [
      // Alice invites Diana to Group 1
      { id: 1, group_id: 1, invited_user_id: 4, invited_by: 1, status: 'pending', created_at: new Date().toISOString() }
    ];
    localStorage.setItem('st_invitations', JSON.stringify(defaultInvitations));
  }
  if (!localStorage.getItem('st_expenses')) {
    // Store amount in cents ($30.00 -> 3000)
    const defaultExpenses = [
      {
        id: 1,
        group_id: 1,
        description: 'Grocery Shopping',
        amount: 3000,
        paid_by: 1, // Paid by Alice
        split_type: 'equal',
        category: 'food',
        expense_date: '2026-06-10',
        notes: 'Milk, Eggs, Bread, and Fruits',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        group_id: 1,
        description: 'Electricity Bill',
        amount: 9000,
        paid_by: 2, // Paid by Bob
        split_type: 'equal',
        category: 'utilities',
        expense_date: '2026-06-12',
        notes: 'June Power Bill',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem('st_expenses', JSON.stringify(defaultExpenses));
  }
  if (!localStorage.getItem('st_splits')) {
    // 3000 split equally between Alice, Bob, Charlie (1000 each)
    // 9000 split equally between Alice, Bob, Charlie (3000 each)
    const defaultSplits = [
      { id: 1, expense_id: 1, user_id: 1, amount_owed: 1000 },
      { id: 2, expense_id: 1, user_id: 2, amount_owed: 1000 },
      { id: 3, expense_id: 1, user_id: 3, amount_owed: 1000 },
      { id: 4, expense_id: 2, user_id: 1, amount_owed: 3000 },
      { id: 5, expense_id: 2, user_id: 2, amount_owed: 3000 },
      { id: 6, expense_id: 2, user_id: 3, amount_owed: 3000 }
    ];
    localStorage.setItem('st_splits', JSON.stringify(defaultSplits));
  }
  if (!localStorage.getItem('st_settlements')) {
    // No default settlements
    localStorage.setItem('st_settlements', JSON.stringify([]));
  }
  if (!localStorage.getItem('st_chat')) {
    const defaultChat = [
      { id: 1, expense_id: 1, user_id: 2, message: 'Thanks for buying the groceries, Alice!', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, expense_id: 1, user_id: 1, message: 'No problem! Don\'t forget to split it.', created_at: new Date(Date.now() - 1800000).toISOString() }
    ];
    localStorage.setItem('st_chat', JSON.stringify(defaultChat));
  }
};

if (USE_MOCK) {
  initMockDB();
}

// Helpers to get/set data
const getData = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

const getLoggedUser = () => {
  const u = localStorage.getItem('st_current_user');
  return u ? JSON.parse(u) : null;
};
const setLoggedUser = (user) => {
  if (user) {
    localStorage.setItem('st_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('st_current_user');
  }
};

// ==========================================
// MOCK CALCULATION UTILITIES
// ==========================================

/**
 * Calculates bilateral balances for a group.
 * Returns a list of who owes whom and net balances.
 */
export const calculateBilateralBalances = (groupId) => {
  const expenses = getData('st_expenses').filter(e => e.group_id === parseInt(groupId));
  const splits = getData('st_splits');
  const settlements = getData('st_settlements');
  const memberships = getData('st_memberships').filter(m => m.group_id === parseInt(groupId));
  const users = getData('st_users');

  const groupUserIds = memberships.map(m => m.user_id);
  const groupUsers = users.filter(u => groupUserIds.includes(u.id));

  // Initialize ledger: ledger[payerId][receiverId] = amount
  const ledger = {};
  groupUserIds.forEach(u1 => {
    ledger[u1] = {};
    groupUserIds.forEach(u2 => {
      ledger[u1][u2] = 0;
    });
  });

  // 1. Process Expenses
  expenses.forEach(exp => {
    const paidBy = exp.paid_by;
    // Get splits for this expense
    const expSplits = splits.filter(s => s.expense_id === exp.id);
    expSplits.forEach(split => {
      const debtor = split.user_id;
      if (groupUserIds.includes(debtor) && groupUserIds.includes(paidBy)) {
        if (debtor !== paidBy) {
          // debtor owes paidBy split.amount_owed
          ledger[debtor][paidBy] += split.amount_owed;
        }
      }
    });
  });

  // 2. Process Settlements
  // Need to filter settlements that occurred between group members?
  // Let's assume settlements are recorded globally, but we only calculate between these group members.
  // Actually, settlements table has payer_id and receiver_id, and they reduce the debt.
  // We can filter settlements if we have a way to match them, but settlements in our DB don't have a group_id.
  // That matches the schema in schema.sql (settlements don't have group_id).
  // So we apply any settlements between the members of this group!
  // To avoid applying settlements from OTHER groups (e.g. personal settlement applied to roomies),
  // in Splitwise, settlements are global or per-group. But since settlements reduces the global debt,
  // we filter settlements between group members.
  settlements.forEach(set => {
    const p = set.payer_id;
    const r = set.receiver_id;
    if (groupUserIds.includes(p) && groupUserIds.includes(r)) {
      // payer_id paid receiver_id, reducing payer's debt to receiver
      ledger[p][r] -= set.amount;
    }
  });

  // Now resolve bilateral debts between each pair
  const debts = [];
  const netBalances = {}; // net balance for each user in this group
  groupUserIds.forEach(id => {
    netBalances[id] = 0;
  });

  for (let i = 0; i < groupUserIds.length; i++) {
    for (let j = i + 1; j < groupUserIds.length; j++) {
      const u1 = groupUserIds[i];
      const u2 = groupUserIds[j];

      // Net amount u1 owes u2:
      // (what u1 owes u2) - (what u2 owes u1)
      const netOwed = ledger[u1][u2] - ledger[u2][u1];

      if (netOwed > 0) {
        // u1 owes u2 netOwed
        debts.push({
          from: u1,
          fromName: groupUsers.find(u => u.id === u1)?.name || 'User ' + u1,
          to: u2,
          toName: groupUsers.find(u => u.id === u2)?.name || 'User ' + u2,
          amount: netOwed
        });
        netBalances[u1] -= netOwed;
        netBalances[u2] += netOwed;
      } else if (netOwed < 0) {
        // u2 owes u1 math.abs(netOwed)
        debts.push({
          from: u2,
          fromName: groupUsers.find(u => u.id === u2)?.name || 'User ' + u2,
          to: u1,
          toName: groupUsers.find(u => u.id === u1)?.name || 'User ' + u1,
          amount: Math.abs(netOwed)
        });
        netBalances[u2] -= Math.abs(netOwed);
        netBalances[u1] += Math.abs(netOwed);
      }
    }
  }

  return { debts, netBalances, groupUsers };
};

/**
 * Calculates global balances for a user across all their groups.
 */
export const calculateGlobalBalances = (userId) => {
  const memberships = getData('st_memberships').filter(m => m.user_id === userId);
  let totalOwed = 0; // Money others owe me (positive overall balance)
  let totalOwe = 0; // Money I owe others (negative overall balance)

  const groupBalances = memberships.map(m => {
    const { debts, netBalances } = calculateBilateralBalances(m.group_id);
    const userNet = netBalances[userId] || 0;
    
    // Sum up debts involving this user in this group
    debts.forEach(d => {
      if (d.from === userId) {
        totalOwe += d.amount;
      } else if (d.to === userId) {
        totalOwed += d.amount;
      }
    });

    return {
      group_id: m.group_id,
      net: userNet
    };
  });

  // Calculate net balance
  // Note: net balance is totalOwed - totalOwe
  const net = totalOwed - totalOwe;

  return {
    net,
    totalOwed,
    totalOwe,
    groupBalances
  };
};

/**
 * Utility to calculate expense splits based on split type.
 * Input:
 * - amount: total amount in cents (integer)
 * - splitType: 'equal', 'unequal', 'percentage', 'share'
 * - participants: array of user IDs
 * - details: split details mapping userId to its value (e.g. percentage value, or share count, or raw amount)
 */
export const calculateSplits = (amount, splitType, participants, details) => {
  if (!participants || participants.length === 0) return [];
  const numParticipants = participants.length;

  let splits = [];
  let sumCalculated = 0;

  if (splitType === 'equal') {
    const baseSplit = Math.floor(amount / numParticipants);
    const remainder = amount - (baseSplit * numParticipants);

    participants.forEach((userId, index) => {
      let owed = baseSplit;
      if (index === 0) {
        owed += remainder; // Remainder goes to the first participant
      }
      splits.push({ user_id: userId, amount_owed: owed });
    });
  } 
  else if (splitType === 'unequal') {
    // Details should map userId -> cents
    participants.forEach(userId => {
      const owed = parseInt(details[userId] || 0);
      splits.push({ user_id: userId, amount_owed: owed });
      sumCalculated += owed;
    });

    // Validation: sum must equal amount
    if (sumCalculated !== amount) {
      throw new Error(`Sum of unequal splits (${sumCalculated} cents) does not match total amount (${amount} cents).`);
    }
  } 
  else if (splitType === 'percentage') {
    // Details should map userId -> percentage (0-100)
    let percentSum = 0;
    participants.forEach(userId => {
      percentSum += parseFloat(details[userId] || 0);
    });

    if (Math.abs(percentSum - 100) > 0.01) {
      throw new Error(`Percentages must sum to 100% (currently ${percentSum}%).`);
    }

    participants.forEach(userId => {
      const percent = parseFloat(details[userId] || 0);
      // Floor the cents to prevent fractional cents
      const owed = Math.floor((amount * percent) / 100);
      splits.push({ user_id: userId, amount_owed: owed });
      sumCalculated += owed;
    });

    // Remainder handling
    const remainder = amount - sumCalculated;
    if (remainder !== 0 && splits.length > 0) {
      splits[0].amount_owed += remainder;
    }
  } 
  else if (splitType === 'share') {
    // Details should map userId -> shares (integers)
    let totalShares = 0;
    participants.forEach(userId => {
      totalShares += parseInt(details[userId] || 0);
    });

    if (totalShares <= 0) {
      throw new Error('Total shares must be greater than 0.');
    }

    participants.forEach(userId => {
      const shares = parseInt(details[userId] || 0);
      const owed = Math.floor((amount * shares) / totalShares);
      splits.push({ user_id: userId, amount_owed: owed });
      sumCalculated += owed;
    });

    // Remainder handling
    const remainder = amount - sumCalculated;
    if (remainder !== 0 && splits.length > 0) {
      // Find the first participant with non-zero shares to add remainder
      const firstActiveIndex = participants.findIndex(userId => parseInt(details[userId] || 0) > 0);
      if (firstActiveIndex !== -1) {
        splits[firstActiveIndex].amount_owed += remainder;
      } else {
        splits[0].amount_owed += remainder;
      }
    }
  }

  return splits;
};


// ==========================================
// API SERVICES IMPLEMENTATION
// ==========================================
export const api = {
  // ------------------------------------------
  // AUTHENTICATION SERVICES
  // ------------------------------------------
  auth: {
    register: async (name, email, password) => {
      if (USE_MOCK) {
        const users = getData('st_users');
        if (users.find(u => u.email === email)) {
          throw new Error('Email already registered.');
        }
        const newUser = {
          id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
          name,
          email,
          password_hash: 'hashed_mock_pw'
        };
        users.push(newUser);
        setData('st_users', users);
        setLoggedUser(newUser);
        return newUser;
      } else {
        const res = await httpClient.post('/auth/register', { name, email, password });
        return res.data;
      }
    },

    login: async (email, password) => {
      if (USE_MOCK) {
        const users = getData('st_users');
        const user = users.find(u => u.email === email);
        if (!user) {
          throw new Error('Invalid email or password.');
        }
        setLoggedUser(user);
        return user;
      } else {
        const res = await httpClient.post('/auth/login', { email, password });
        return res.data;
      }
    },

    logout: async () => {
      if (USE_MOCK) {
        setLoggedUser(null);
        return { message: 'Logged out successfully' };
      } else {
        const res = await httpClient.post('/auth/logout');
        return res.data;
      }
    },

    getMe: async () => {
      if (USE_MOCK) {
        const user = getLoggedUser();
        if (!user) throw new Error('Not authenticated');
        return user;
      } else {
        const res = await httpClient.get('/auth/me');
        return res.data;
      }
    }
  },

  // ------------------------------------------
  // GROUP SERVICES
  // ------------------------------------------
  groups: {
    create: async (name) => {
      if (USE_MOCK) {
        const currentUser = getLoggedUser();
        if (!currentUser) throw new Error('Not authenticated');

        const groups = getData('st_groups');
        const newGroup = {
          id: groups.length ? Math.max(...groups.map(g => g.id)) + 1 : 1,
          name,
          created_by: currentUser.id,
          created_at: new Date().toISOString()
        };
        groups.push(newGroup);
        setData('st_groups', groups);

        // Add creator as admin member
        const memberships = getData('st_memberships');
        const newMembership = {
          id: memberships.length ? Math.max(...memberships.map(m => m.id)) + 1 : 1,
          group_id: newGroup.id,
          user_id: currentUser.id,
          role: 'admin',
          joined_at: new Date().toISOString()
        };
        memberships.push(newMembership);
        setData('st_memberships', memberships);

        return newGroup;
      } else {
        const res = await httpClient.post('/groups', { name });
        return res.data;
      }
    },

    list: async () => {
      if (USE_MOCK) {
        const currentUser = getLoggedUser();
        if (!currentUser) throw new Error('Not authenticated');

        const memberships = getData('st_memberships').filter(m => m.user_id === currentUser.id);
        const groups = getData('st_groups');
        
        return groups.filter(g => memberships.some(m => m.group_id === g.id));
      } else {
        const res = await httpClient.get('/groups');
        return res.data;
      }
    },

    getById: async (id) => {
      const gId = parseInt(id);
      if (USE_MOCK) {
        const group = getData('st_groups').find(g => g.id === gId);
        if (!group) throw new Error('Group not found');

        const memberships = getData('st_memberships').filter(m => m.group_id === gId);
        const users = getData('st_users');
        
        const members = memberships.map(m => {
          const userObj = users.find(u => u.id === m.user_id);
          return {
            ...m,
            name: userObj?.name,
            email: userObj?.email
          };
        });

        const expenses = getData('st_expenses').filter(e => e.group_id === gId);

        return {
          ...group,
          members,
          expenses
        };
      } else {
        const res = await httpClient.get(`/groups/${gId}`);
        return res.data;
      }
    },

    update: async (id, name) => {
      const gId = parseInt(id);
      if (USE_MOCK) {
        const groups = getData('st_groups');
        const index = groups.findIndex(g => g.id === gId);
        if (index === -1) throw new Error('Group not found');
        groups[index].name = name;
        setData('st_groups', groups);
        return groups[index];
      } else {
        const res = await httpClient.put(`/groups/${gId}`, { name });
        return res.data;
      }
    },

    delete: async (id) => {
      const gId = parseInt(id);
      if (USE_MOCK) {
        // Verify balances are settled before delete
        const { debts } = calculateBilateralBalances(gId);
        const outstanding = debts.reduce((sum, d) => sum + d.amount, 0);
        if (outstanding > 0) {
          throw new Error('Cannot delete group. All balances must be settled first.');
        }

        const groups = getData('st_groups').filter(g => g.id !== gId);
        setData('st_groups', groups);

        const memberships = getData('st_memberships').filter(m => m.group_id !== gId);
        setData('st_memberships', memberships);

        const expenses = getData('st_expenses').filter(e => e.group_id !== gId);
        setData('st_expenses', expenses);

        return { message: 'Group deleted successfully' };
      } else {
        const res = await httpClient.delete(`/groups/${gId}`);
        return res.data;
      }
    },

    invite: async (groupId, email) => {
      const gId = parseInt(groupId);
      if (USE_MOCK) {
        const currentUser = getLoggedUser();
        const users = getData('st_users');
        const invitee = users.find(u => u.email === email);

        if (!invitee) {
          throw new Error(`No registered user found with email: ${email}`);
        }

        const memberships = getData('st_memberships');
        if (memberships.some(m => m.group_id === gId && m.user_id === invitee.id)) {
          throw new Error('User is already a member of this group.');
        }

        const invitations = getData('st_invitations');
        if (invitations.some(i => i.group_id === gId && i.invited_user_id === invitee.id && i.status === 'pending')) {
          throw new Error('An invitation is already pending for this user.');
        }

        const newInvite = {
          id: invitations.length ? Math.max(...invitations.map(i => i.id)) + 1 : 1,
          group_id: gId,
          invited_user_id: invitee.id,
          invited_by: currentUser.id,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        invitations.push(newInvite);
        setData('st_invitations', invitations);

        return { message: 'Invitation sent successfully', invitation: newInvite };
      } else {
        const res = await httpClient.post(`/groups/${gId}/invite`, { email });
        return res.data;
      }
    }
  },

  // ------------------------------------------
  // INVITATION SERVICES
  // ------------------------------------------
  invitations: {
    listPending: async () => {
      if (USE_MOCK) {
        const currentUser = getLoggedUser();
        if (!currentUser) throw new Error('Not authenticated');

        const invitations = getData('st_invitations').filter(
          i => i.invited_user_id === currentUser.id && i.status === 'pending'
        );
        const groups = getData('st_groups');
        const users = getData('st_users');

        return invitations.map(inv => {
          const group = groups.find(g => g.id === inv.group_id);
          const inviter = users.find(u => u.id === inv.invited_by);
          return {
            ...inv,
            group_name: group?.name || 'Unknown Group',
            invited_by_name: inviter?.name || 'Someone'
          };
        });
      } else {
        const res = await httpClient.get('/invitations/pending');
        return res.data;
      }
    },

    accept: async (id) => {
      const invId = parseInt(id);
      if (USE_MOCK) {
        const invitations = getData('st_invitations');
        const invIndex = invitations.findIndex(i => i.id === invId);
        if (invIndex === -1) throw new Error('Invitation not found');

        const invitation = invitations[invIndex];
        invitation.status = 'accepted';
        setData('st_invitations', invitations);

        // Add to memberships
        const memberships = getData('st_memberships');
        const newMembership = {
          id: memberships.length ? Math.max(...memberships.map(m => m.id)) + 1 : 1,
          group_id: invitation.group_id,
          user_id: invitation.invited_user_id,
          role: 'member',
          joined_at: new Date().toISOString()
        };
        memberships.push(newMembership);
        setData('st_memberships', memberships);

        return { message: 'Invitation accepted successfully' };
      } else {
        const res = await httpClient.post(`/invitations/${invId}/accept`);
        return res.data;
      }
    },

    reject: async (id) => {
      const invId = parseInt(id);
      if (USE_MOCK) {
        const invitations = getData('st_invitations');
        const invIndex = invitations.findIndex(i => i.id === invId);
        if (invIndex === -1) throw new Error('Invitation not found');

        invitations[invIndex].status = 'rejected';
        setData('st_invitations', invitations);

        return { message: 'Invitation rejected successfully' };
      } else {
        const res = await httpClient.post(`/invitations/${invId}/reject`);
        return res.data;
      }
    }
  },

  // ------------------------------------------
  // EXPENSE SERVICES
  // ------------------------------------------
  expenses: {
    create: async (expenseData) => {
      // expenseData: { group_id, description, amount (cents), paid_by, split_type, category, expense_date, notes, participants, split_details }
      if (USE_MOCK) {
        const expenses = getData('st_expenses');
        const newExpId = expenses.length ? Math.max(...expenses.map(e => e.id)) + 1 : 1;

        const splitsData = calculateSplits(
          expenseData.amount,
          expenseData.split_type,
          expenseData.participants,
          expenseData.split_details
        );

        const newExpense = {
          id: newExpId,
          group_id: expenseData.group_id ? parseInt(expenseData.group_id) : null,
          description: expenseData.description,
          amount: parseInt(expenseData.amount),
          paid_by: parseInt(expenseData.paid_by),
          split_type: expenseData.split_type,
          category: expenseData.category || 'other',
          expense_date: expenseData.expense_date,
          notes: expenseData.notes || '',
          created_at: new Date().toISOString()
        };

        expenses.push(newExpense);
        setData('st_expenses', expenses);

        // Save splits
        const allSplits = getData('st_splits');
        splitsData.forEach(s => {
          allSplits.push({
            id: allSplits.length ? Math.max(...allSplits.map(sp => sp.id)) + 1 : 1,
            expense_id: newExpId,
            user_id: s.user_id,
            amount_owed: s.amount_owed
          });
        });
        setData('st_splits', allSplits);

        return { ...newExpense, splits: splitsData };
      } else {
        const res = await httpClient.post('/expenses', expenseData);
        return res.data;
      }
    },

    getById: async (id) => {
      const expId = parseInt(id);
      if (USE_MOCK) {
        const expense = getData('st_expenses').find(e => e.id === expId);
        if (!expense) throw new Error('Expense not found');

        const splits = getData('st_splits').filter(s => s.expense_id === expId);
        const users = getData('st_users');

        const splitsDetailed = splits.map(s => {
          const u = users.find(user => user.id === s.user_id);
          return {
            ...s,
            user_name: u?.name || 'Unknown User'
          };
        });

        const payer = users.find(u => u.id === expense.paid_by);

        return {
          ...expense,
          payer_name: payer?.name || 'Unknown Payer',
          splits: splitsDetailed
        };
      } else {
        const res = await httpClient.get(`/expenses/${expId}`);
        return res.data;
      }
    },

    update: async (id, expenseData) => {
      const expId = parseInt(id);
      if (USE_MOCK) {
        const expenses = getData('st_expenses');
        const index = expenses.findIndex(e => e.id === expId);
        if (index === -1) throw new Error('Expense not found');

        // Re-calculate splits
        const splitsData = calculateSplits(
          expenseData.amount,
          expenseData.split_type,
          expenseData.participants,
          expenseData.split_details
        );

        // Update main expense
        expenses[index] = {
          ...expenses[index],
          description: expenseData.description,
          amount: parseInt(expenseData.amount),
          paid_by: parseInt(expenseData.paid_by),
          split_type: expenseData.split_type,
          category: expenseData.category || 'other',
          expense_date: expenseData.expense_date,
          notes: expenseData.notes || '',
        };
        setData('st_expenses', expenses);

        // Remove old splits and write new ones
        let allSplits = getData('st_splits').filter(s => s.expense_id !== expId);
        splitsData.forEach(s => {
          allSplits.push({
            id: allSplits.length ? Math.max(...allSplits.map(sp => sp.id)) + 1 : 1,
            expense_id: expId,
            user_id: s.user_id,
            amount_owed: s.amount_owed
          });
        });
        setData('st_splits', allSplits);

        return expenses[index];
      } else {
        const res = await httpClient.put(`/expenses/${expId}`, expenseData);
        return res.data;
      }
    },

    delete: async (id) => {
      const expId = parseInt(id);
      if (USE_MOCK) {
        const expenses = getData('st_expenses').filter(e => e.id !== expId);
        setData('st_expenses', expenses);

        const splits = getData('st_splits').filter(s => s.expense_id !== expId);
        setData('st_splits', splits);

        const messages = getData('st_chat').filter(m => m.expense_id !== expId);
        setData('st_chat', messages);

        return { message: 'Expense deleted successfully' };
      } else {
        const res = await httpClient.delete(`/expenses/${expId}`);
        return res.data;
      }
    }
  },

  // ------------------------------------------
  // SETTLEMENT SERVICES
  // ------------------------------------------
  settlements: {
    create: async (payerId, receiverId, amountCents, notes) => {
      if (USE_MOCK) {
        const settlements = getData('st_settlements');
        const newSet = {
          id: settlements.length ? Math.max(...settlements.map(s => s.id)) + 1 : 1,
          payer_id: parseInt(payerId),
          receiver_id: parseInt(receiverId),
          amount: parseInt(amountCents),
          settlement_date: new Date().toISOString().split('T')[0],
          notes: notes || 'Settle payment',
          created_at: new Date().toISOString()
        };
        settlements.push(newSet);
        setData('st_settlements', settlements);
        return newSet;
      } else {
        const res = await httpClient.post('/settlements', {
          payer_id: payerId,
          receiver_id: receiverId,
          amount: amountCents,
          settlement_date: new Date().toISOString().split('T')[0],
          notes
        });
        return res.data;
      }
    },

    list: async () => {
      if (USE_MOCK) {
        const settlements = getData('st_settlements');
        const users = getData('st_users');

        return settlements.map(s => {
          const payer = users.find(u => u.id === s.payer_id);
          const receiver = users.find(u => u.id === s.receiver_id);
          return {
            ...s,
            payer_name: payer?.name || 'Unknown Payer',
            receiver_name: receiver?.name || 'Unknown Receiver'
          };
        }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      } else {
        const res = await httpClient.get('/settlements');
        return res.data;
      }
    }
  },

  // ------------------------------------------
  // BALANCE ENGINE WRAPPERS
  // ------------------------------------------
  balances: {
    getGroupBalances: async (groupId) => {
      if (USE_MOCK) {
        return calculateBilateralBalances(groupId);
      } else {
        const res = await httpClient.get(`/groups/${groupId}/balances`);
        return res.data;
      }
    },

    getMyBalances: async () => {
      if (USE_MOCK) {
        const currentUser = getLoggedUser();
        if (!currentUser) throw new Error('Not authenticated');
        return calculateGlobalBalances(currentUser.id);
      } else {
        const res = await httpClient.get('/users/me/balances');
        return res.data;
      }
    }
  },

  // ------------------------------------------
  // CHAT SERVICES
  // ------------------------------------------
  chat: {
    getMessages: async (expenseId) => {
      const expId = parseInt(expenseId);
      if (USE_MOCK) {
        const chat = getData('st_chat').filter(m => m.expense_id === expId);
        const users = getData('st_users');

        return chat.map(m => {
          const u = users.find(user => user.id === m.user_id);
          return {
            ...m,
            user_name: u?.name || 'Unknown User'
          };
        }).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      } else {
        const res = await httpClient.get(`/expenses/${expId}/messages`);
        return res.data;
      }
    },

    sendMessage: async (expenseId, messageText) => {
      const expId = parseInt(expenseId);
      if (USE_MOCK) {
        const currentUser = getLoggedUser();
        if (!currentUser) throw new Error('Not authenticated');

        const chat = getData('st_chat');
        const newMessage = {
          id: chat.length ? Math.max(...chat.map(m => m.id)) + 1 : 1,
          expense_id: expId,
          user_id: currentUser.id,
          message: messageText,
          created_at: new Date().toISOString()
        };

        chat.push(newMessage);
        setData('st_chat', chat);

        const users = getData('st_users');
        const detailedMessage = {
          ...newMessage,
          user_name: currentUser.name
        };

        // Simulate a chatbot reply for interactive websocket feel!
        setTimeout(() => {
          const botReplies = [
            "Got it! Let's check the balance sheet.",
            "Can you verify the splits on this one?",
            "Sounds good to me.",
            "I'll settle this up soon!",
            "Thanks for update!"
          ];
          const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)];
          const randomUser = users.find(u => u.id !== currentUser.id) || users[0];

          const botMsg = {
            id: chat.length + 10,
            expense_id: expId,
            user_id: randomUser.id,
            message: randomReply,
            created_at: new Date().toISOString()
          };

          const activeChat = getData('st_chat');
          activeChat.push(botMsg);
          setData('st_chat', activeChat);

          // Dispatch a custom event to notify components listening
          window.dispatchEvent(new CustomEvent('st_mock_message_received', {
            detail: { ...botMsg, user_name: randomUser.name }
          }));
        }, 1500);

        return detailedMessage;
      } else {
        // Handled via SocketIO in real code, but can use REST fallback if needed
        // For REST fallback or socket initialization:
        return { message: 'Message sent via Socket' };
      }
    }
  }
};
