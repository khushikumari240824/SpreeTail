// src/context/GroupContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const GroupContext = createContext(null);

export const GroupProvider = ({ children }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [globalBalances, setGlobalBalances] = useState({ net: 0, totalOwed: 0, totalOwe: 0, groupBalances: [] });

  const fetchGroups = async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const list = await api.groups.list();
      setGroups(list);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchPendingInvites = async () => {
    if (!user) return;
    try {
      const list = await api.invitations.listPending();
      setPendingInvites(list);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    }
  };

  const fetchGlobalBalances = async () => {
    if (!user) return;
    try {
      const bal = await api.balances.getMyBalances();
      setGlobalBalances(bal);
    } catch (err) {
      console.error('Error fetching global balances:', err);
    }
  };

  // Fetch groups and invites when user logs in or out
  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchPendingInvites();
      fetchGlobalBalances();
    } else {
      setGroups([]);
      setPendingInvites([]);
      setGlobalBalances({ net: 0, totalOwed: 0, totalOwe: 0, groupBalances: [] });
    }
  }, [user]);

  const createGroup = async (name) => {
    try {
      const newGroup = await api.groups.create(name);
      await fetchGroups();
      await fetchGlobalBalances();
      return newGroup;
    } catch (err) {
      console.error('Error creating group:', err);
      throw err;
    }
  };

  const acceptInvite = async (inviteId) => {
    try {
      await api.invitations.accept(inviteId);
      await fetchPendingInvites();
      await fetchGroups();
      await fetchGlobalBalances();
    } catch (err) {
      console.error('Error accepting invite:', err);
      throw err;
    }
  };

  const rejectInvite = async (inviteId) => {
    try {
      await api.invitations.reject(inviteId);
      await fetchPendingInvites();
    } catch (err) {
      console.error('Error rejecting invite:', err);
      throw err;
    }
  };

  const inviteUserToGroup = async (groupId, email) => {
    try {
      await api.groups.invite(groupId, email);
    } catch (err) {
      console.error('Error sending group invite:', err);
      throw err;
    }
  };

  const refreshAllData = async () => {
    await Promise.all([
      fetchGroups(),
      fetchPendingInvites(),
      fetchGlobalBalances()
    ]);
  };

  return (
    <GroupContext.Provider value={{
      groups,
      pendingInvites,
      loadingGroups,
      globalBalances,
      fetchGroups,
      fetchPendingInvites,
      fetchGlobalBalances,
      createGroup,
      acceptInvite,
      rejectInvite,
      inviteUserToGroup,
      refreshAllData
    }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroups = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupProvider');
  }
  return context;
};
