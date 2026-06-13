// src/pages/Profile.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { formatCents, getBalanceClass } from '../utils/format';
import { User, Mail, LogOut, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';

const Profile = () => {
  const { user, logout } = useAuth();
  const { groups, globalBalances } = useGroups();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="profile-container page-layout">
      <header className="page-header">
        <div>
          <h1>My Profile</h1>
          <p className="subtitle">Your account details and summary</p>
        </div>
      </header>

      <div className="profile-workspace">
        {/* Profile Card */}
        <section className="profile-card glass">
          <div className="profile-avatar-large">{initials}</div>
          <h2 className="profile-name">{user.name}</h2>
          <p className="profile-email">
            <Mail size={14} className="inline-icon" />
            {user.email}
          </p>

          <div className="profile-stat-grid">
            <div className="profile-stat-item">
              <Users size={20} className="stat-icon text-accent" />
              <span className="stat-value">{groups.length}</span>
              <span className="stat-label">Groups</span>
            </div>
            <div className="profile-stat-item">
              <TrendingUp size={20} className="stat-icon text-emerald" />
              <span className="stat-value">{formatCents(globalBalances.totalOwed)}</span>
              <span className="stat-label">You are owed</span>
            </div>
            <div className="profile-stat-item">
              <TrendingDown size={20} className="stat-icon text-amber" />
              <span className="stat-value">{formatCents(globalBalances.totalOwe)}</span>
              <span className="stat-label">You owe</span>
            </div>
          </div>

          <div className="net-balance-display glass-inner">
            <DollarSign size={18} />
            <span>Net Balance: </span>
            <strong className={getBalanceClass(globalBalances.net)}>
              {formatCents(globalBalances.net)}
            </strong>
          </div>

          <button className="btn btn-danger profile-logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            Log Out
          </button>
        </section>

        {/* Groups List quick view */}
        <section className="profile-groups-panel glass">
          <h3>Your Groups</h3>
          {groups.length === 0 ? (
            <p className="empty-text">You haven't joined any groups yet.</p>
          ) : (
            <div className="profile-groups-list">
              {groups.map(g => {
                const bal = globalBalances.groupBalances?.find(b => b.group_id === g.id)?.net || 0;
                return (
                  <div
                    key={g.id}
                    className="profile-group-row hover-card"
                    onClick={() => navigate(`/groups/${g.id}`)}
                  >
                    <div className="pg-name">{g.name}</div>
                    <div className={`pg-bal ${getBalanceClass(bal)}`}>
                      {bal > 0 ? `+${formatCents(bal)}` : bal < 0 ? `-${formatCents(Math.abs(bal))}` : 'Settled'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Profile;
