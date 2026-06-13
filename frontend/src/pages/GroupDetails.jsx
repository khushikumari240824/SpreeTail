// src/pages/GroupDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { api } from '../services/api';
import { formatCents, formatCategory } from '../utils/format';
import ExpenseModal from '../components/ExpenseModal';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  UserPlus, 
  DollarSign, 
  Receipt,
  MessageSquare,
  FileText
} from 'lucide-react';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshAllData } = useGroups();

  const [group, setGroup] = useState(null);
  const [debts, setDebts] = useState([]);
  const [netBalances, setNetBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Edit Group Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // Member Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Expense Modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  // Settle Up Modal state
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settlePayer, setSettlePayer] = useState('');
  const [settleReceiver, setSettleReceiver] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const groupDetails = await api.groups.getById(id);
      setGroup(groupDetails);
      setEditName(groupDetails.name);

      const bal = await api.balances.getGroupBalances(id);
      setDebts(bal.debts || []);
      setNetBalances(bal.netBalances || {});
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error loading group details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpdateGroupName = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    try {
      await api.groups.update(id, editName.trim());
      setIsEditingName(false);
      loadData();
      refreshAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Error updating group name.');
    }
  };

  const handleDeleteGroup = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this group? This action cannot be undone.');
    if (!confirmDelete) return;

    try {
      await api.groups.delete(id);
      refreshAllData();
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Error deleting group.');
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviteSuccess(false);
    setErrorMsg(null);
    try {
      await api.groups.invite(id, inviteEmail.trim());
      setInviteSuccess(true);
      setInviteEmail('');
      loadData(); // Reload member list
      setTimeout(() => setInviteSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Error inviting member.');
    }
  };

  const openAddExpense = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  const openEditExpense = (expense) => {
    // Need full expense splits
    api.expenses.getById(expense.id).then(fullExp => {
      setExpenseToEdit(fullExp);
      setIsExpenseModalOpen(true);
    }).catch(err => {
      setErrorMsg('Error loading expense splits details.');
    });
  };

  const handleDeleteExpense = async (expId, e) => {
    e.stopPropagation(); // Avoid navigating to expense details
    const confirmDel = window.confirm('Are you sure you want to delete this expense?');
    if (!confirmDel) return;

    try {
      await api.expenses.delete(expId);
      loadData();
      refreshAllData();
    } catch (err) {
      setErrorMsg('Error deleting expense.');
    }
  };

  const openQuickSettle = (debt) => {
    setSettlePayer(debt.from.toString());
    setSettleReceiver(debt.to.toString());
    setSettleAmount((debt.amount / 100).toFixed(2));
    setSettleNotes(`Settling debt in ${group?.name}`);
    setIsSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const amtVal = parseFloat(settleAmount);
    if (isNaN(amtVal) || amtVal <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const amtCents = Math.round(amtVal * 100);

    try {
      await api.settlements.create(settlePayer, settleReceiver, amtCents, settleNotes);
      setIsSettleModalOpen(false);
      loadData();
      refreshAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Error recording settlement.');
    }
  };

  if (loading && !group) {
    return <div className="loading-state">Loading group details...</div>;
  }

  if (errorMsg && !group) {
    return (
      <div className="error-state">
        <h3>Oops!</h3>
        <p>{errorMsg}</p>
        <Link to="/dashboard" className="btn btn-secondary"><ArrowLeft size={16} /> Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="group-details-container page-layout">
      {/* Header */}
      <header className="group-header glass">
        <div className="header-nav-title">
          <Link to="/dashboard" className="back-link"><ArrowLeft size={20} /></Link>
          {isEditingName ? (
            <form onSubmit={handleUpdateGroupName} className="edit-name-form">
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="btn-icon-check"><Check size={18} /></button>
            </form>
          ) : (
            <div className="group-title-box">
              <h2>{group?.name}</h2>
              <button className="btn-icon-edit" onClick={() => setIsEditingName(true)}><Edit3 size={16} /></button>
            </div>
          )}
        </div>

        <div className="group-actions">
          <button className="btn btn-primary" onClick={openAddExpense}>
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
          <button className="btn btn-danger btn-icon" onClick={handleDeleteGroup}>
            <Trash2 size={16} />
            <span>Delete Group</span>
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="group-workspace">
        {/* Left Side: Activity / Expense Feed */}
        <section className="group-activity-feed glass">
          <div className="section-header">
            <h3>Expenses Feed</h3>
          </div>

          {group?.expenses?.length === 0 ? (
            <div className="empty-feed-box">
              <Receipt size={48} className="empty-icon" />
              <h4>No expenses yet</h4>
              <p>Add an expense using the button above to start sharing bills.</p>
            </div>
          ) : (
            <div className="expenses-feed-list">
              {group?.expenses?.slice().sort((a,b) => new Date(b.expense_date) - new Date(a.expense_date)).map(exp => {
                const payerName = group.members.find(m => m.user_id === exp.paid_by)?.name || 'Someone';
                const isPaidByMe = exp.paid_by === user.id;

                return (
                  <div 
                    key={exp.id} 
                    className="expense-feed-item hover-card"
                    onClick={() => navigate(`/expenses/${exp.id}`)}
                  >
                    <div className="expense-date-tag">
                      <span className="month">{new Date(exp.expense_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="day">{new Date(exp.expense_date).toLocaleDateString('en-US', { day: '2-digit' })}</span>
                    </div>

                    <div className="expense-core-desc">
                      <h4>{exp.description}</h4>
                      <span className="payer-info">
                        Paid by <strong>{isPaidByMe ? 'You' : payerName}</strong>
                      </span>
                    </div>

                    <div className="expense-amounts">
                      <div className="total-amount">
                        <span className="amount-label">Total Amount</span>
                        <span className="amount-value">{formatCents(exp.amount)}</span>
                      </div>
                    </div>

                    <div className="expense-actions-bar" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-xs btn-icon" onClick={() => openEditExpense(exp)}>
                        <Edit3 size={12} />
                      </button>
                      <button className="btn btn-danger btn-xs btn-icon" onClick={(e) => handleDeleteExpense(exp.id, e)}>
                        <Trash2 size={12} />
                      </button>
                      <button className="btn btn-accent btn-xs btn-icon" onClick={() => navigate(`/expenses/${exp.id}`)}>
                        <MessageSquare size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Side: Members and Balances */}
        <div className="group-sidebar-panels">
          {/* Member invite & list */}
          <section className="group-members-panel glass">
            <h3>Group Members ({group?.members?.length})</h3>

            <form onSubmit={handleInviteUser} className="invite-form">
              <div className="invite-input-row">
                <input 
                  type="email" 
                  placeholder="Invite user by email..." 
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm"><UserPlus size={16} /></button>
              </div>
              {inviteSuccess && <span className="text-success inline-alert">Invitation sent successfully!</span>}
            </form>

            <div className="members-badge-list">
              {group?.members?.map(member => (
                <div key={member.user_id} className="member-badge-item">
                  <div className="avatar avatar-sm">
                    {member.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-details">
                    <span className="name">{member.name} {member.user_id === user.id && '(You)'}</span>
                    <span className="role">{member.role === 'admin' ? 'Admin' : 'Member'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Group Balance Sheet / Bilateral Debts */}
          <section className="group-balances-panel glass">
            <h3>Group Balances</h3>
            
            {debts.length === 0 ? (
              <div className="settled-status-box">
                <Check size={32} className="text-success" />
                <p>All group members are settled up!</p>
              </div>
            ) : (
              <div className="debts-list">
                {debts.map((debt, index) => {
                  const isIMayPay = debt.from === user.id;
                  const isIMayReceive = debt.to === user.id;
                  
                  return (
                    <div key={index} className="debt-card">
                      <div className="debt-flow-info">
                        <strong>{isIMayPay ? 'You' : debt.fromName}</strong> owes <strong>{isIMayReceive ? 'you' : debt.toName}</strong>:
                        <div className="debt-val">{formatCents(debt.amount)}</div>
                      </div>
                      
                      {isIMayPay && (
                        <button 
                          className="btn btn-success btn-xs"
                          onClick={() => openQuickSettle(debt)}
                        >
                          <DollarSign size={12} /> Settle Up
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Settle Up Confirmation Dialog */}
      {isSettleModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSettleModalOpen(false)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Record a Payment Settlement</h3>
              <button className="close-btn" onClick={() => setIsSettleModalOpen(false)}><X size={20} /></button>
            </header>

            <form onSubmit={handleSettleSubmit} className="settle-form">
              <div className="form-group">
                <label>Payer</label>
                <select value={settlePayer} onChange={(e) => setSettlePayer(e.target.value)} required>
                  {group?.members?.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Receiver</label>
                <select value={settleReceiver} onChange={(e) => setSettleReceiver(e.target.value)} required>
                  {group?.members?.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Amount ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <input 
                  type="text" 
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSettleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Creator/Editor Modal */}
      <ExpenseModal 
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        groupId={id}
        members={group?.members || []}
        expenseToEdit={expenseToEdit}
        onSave={loadData}
      />
    </div>
  );
};

export default GroupDetails;
