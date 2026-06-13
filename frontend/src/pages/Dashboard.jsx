// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGroups } from '../context/GroupContext';
import { formatCents, getBalanceClass } from '../utils/format';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  ArrowRight,
  MailOpen,
  Check,
  X,
  Users
} from 'lucide-react';

const Dashboard = () => {
  const { 
    groups, 
    pendingInvites, 
    globalBalances, 
    acceptInvite, 
    rejectInvite,
    createGroup,
    refreshAllData 
  } = useGroups();
  
  const navigate = useNavigate();
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const group = await createGroup(newGroupName.trim());
      setNewGroupName('');
      setIsCreating(false);
      navigate(`/groups/${group.id}`);
    } catch (err) {
      alert('Error creating group.');
    }
  };

  return (
    <div className="dashboard-container page-layout">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Welcome to your shared expense hub</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
          <Plus size={18} />
          <span>New Group</span>
        </button>
      </header>

      {/* Group Create Modal/Form (inlined/collapsible) */}
      {isCreating && (
        <div className="modal-backdrop" onClick={() => setIsCreating(false)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <h3>Create a New Group</h3>
            <form onSubmit={handleCreateGroupSubmit}>
              <div className="form-group">
                <label htmlFor="groupName">Group Name</label>
                <input 
                  type="text" 
                  id="groupName" 
                  placeholder="e.g. Ski Trip 2026, Rent split" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Balances Summary Board */}
      <section className="balances-board">
        <div className="balance-card glass total-balance">
          <div className="card-icon"><DollarSign size={24} /></div>
          <div className="card-details">
            <span className="card-label">Total Net Balance</span>
            <h2 className={getBalanceClass(globalBalances.net)}>
              {formatCents(globalBalances.net)}
            </h2>
          </div>
        </div>

        <div className="balance-card glass total-owe">
          <div className="card-icon text-amber"><TrendingDown size={24} /></div>
          <div className="card-details">
            <span className="card-label">You Owe</span>
            <h2 className="balance-owe">{formatCents(globalBalances.totalOwe)}</h2>
          </div>
        </div>

        <div className="balance-card glass total-owed">
          <div className="card-icon text-emerald"><TrendingUp size={24} /></div>
          <div className="card-details">
            <span className="card-label">You Are Owed</span>
            <h2 className="balance-owed">{formatCents(globalBalances.totalOwed)}</h2>
          </div>
        </div>
      </section>

      {/* Pending Invites Alert Drawer */}
      {pendingInvites.length > 0 && (
        <section className="invites-alert-box glass animate-slide-down">
          <div className="alert-header">
            <MailOpen className="alert-icon" size={20} />
            <h3>Pending Group Invitations ({pendingInvites.length})</h3>
          </div>
          <div className="invites-list">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="invite-item">
                <div className="invite-info">
                  <span className="inviter-name">{invite.invited_by_name}</span> invited you to join <strong>{invite.group_name}</strong>
                </div>
                <div className="invite-actions">
                  <button 
                    className="btn btn-success btn-icon btn-sm" 
                    onClick={() => acceptInvite(invite.id)}
                    aria-label="Accept"
                  >
                    <Check size={16} /> Accept
                  </button>
                  <button 
                    className="btn btn-danger btn-icon btn-sm" 
                    onClick={() => rejectInvite(invite.id)}
                    aria-label="Reject"
                  >
                    <X size={16} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Groups Section */}
      <section className="dashboard-groups-section">
        <div className="section-title-bar">
          <h3>Your Groups ({groups.length})</h3>
          <Link to="/groups" className="btn-link">View all <ArrowRight size={14} /></Link>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state-box glass">
            <Users size={48} className="empty-icon" />
            <h4>No groups yet</h4>
            <p>Create a group or wait for your friends to invite you to start splitting bills!</p>
            <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
              <Plus size={16} /> Create Group
            </button>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => {
              // Find the net balance of the current user in this group
              const grpBal = globalBalances.groupBalances?.find(b => b.group_id === group.id)?.net || 0;
              return (
                <div 
                  key={group.id} 
                  className="group-summary-card glass hover-card"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <div className="card-header">
                    <h4>{group.name}</h4>
                    <span className="members-indicator">
                      {new Date(group.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="card-footer">
                    <span className="status-label">Your Balance:</span>
                    <div className="group-balance-status">
                      {grpBal > 0 && (
                        <span className="balance-owed">You are owed {formatCents(grpBal)}</span>
                      )}
                      {grpBal < 0 && (
                        <span className="balance-owe">You owe {formatCents(Math.abs(grpBal))}</span>
                      )}
                      {grpBal === 0 && (
                        <span className="balance-settled">All settled up</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
