// src/pages/GroupsList.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../context/GroupContext';
import { formatCents, getBalanceClass } from '../utils/format';
import { Plus, Users, Search, FolderClosed, Calendar } from 'lucide-react';

const GroupsList = () => {
  const { groups, globalBalances, createGroup } = useGroups();
  const navigate = useNavigate();
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="groups-list-container page-layout">
      <header className="page-header">
        <div>
          <h1>My Groups</h1>
          <p className="subtitle">Track and settle bills with different circles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
          <Plus size={18} />
          <span>Create Group</span>
        </button>
      </header>

      {/* Group Create Modal */}
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
                  placeholder="e.g. Household Bills, Roadtrip" 
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

      {/* Search Filter Bar */}
      <div className="filter-bar glass">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search groups..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Group List Display */}
      {filteredGroups.length === 0 ? (
        <div className="empty-state-box glass">
          <FolderClosed size={48} className="empty-icon" />
          <h4>{searchQuery ? 'No matching groups' : 'No groups found'}</h4>
          <p>{searchQuery ? 'Try matching a different group name.' : 'Start by creating your first group to share expenses!'}</p>
        </div>
      ) : (
        <div className="groups-directory-grid">
          {filteredGroups.map(group => {
            const grpBal = globalBalances.groupBalances?.find(b => b.group_id === group.id)?.net || 0;
            return (
              <div 
                key={group.id} 
                className="group-directory-card glass hover-card"
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <div className="card-top">
                  <div className="group-avatar-large">
                    <Users size={24} />
                  </div>
                  <div className="group-core-info">
                    <h4>{group.name}</h4>
                    <span className="creation-date">
                      <Calendar size={12} />
                      Created {new Date(group.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="card-bottom">
                  <span className="status-label">Your Balance</span>
                  <div className="balance-info">
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
    </div>
  );
};

export default GroupsList;
