// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GroupProvider } from './context/GroupContext';

import Sidebar from './components/Sidebar';
import LoginRegister from './pages/LoginRegister';
import Dashboard from './pages/Dashboard';
import GroupsList from './pages/GroupsList';
import GroupDetails from './pages/GroupDetails';
import ExpenseDetails from './pages/ExpenseDetails';
import SettlementLog from './pages/SettlementLog';
import Profile from './pages/Profile';

// ─── Protected Route Guard ─────────────────────────────────────────────────
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Loading SpreeTail Split...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <GroupProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </GroupProvider>
  );
};

// ─── Public Route Guard (redirect if already logged in) ────────────────────
const PublicRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Loading SpreeTail Split...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

// ─── App Root ──────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginRegister />} />
            <Route path="/register" element={<LoginRegister />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsList />} />
            <Route path="/groups/:id" element={<GroupDetails />} />
            <Route path="/expenses/:id" element={<ExpenseDetails />} />
            <Route path="/settlements" element={<SettlementLog />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
