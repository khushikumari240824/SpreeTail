// src/pages/LoginRegister.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PiggyBank, Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

const LoginRegister = () => {
  const { login, register, error, setError } = useAuth();
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.name, formData.email, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (email) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, 'hashed');
      navigate('/dashboard');
    } catch (err) {
      console.error('Demo auth error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts = [
    { name: 'Alice (Creator)', email: 'alice@example.com' },
    { name: 'Bob (Member)', email: 'bob@example.com' },
    { name: 'Charlie (Member)', email: 'charlie@example.com' },
    { name: 'Diana (Guest)', email: 'diana@example.com' }
  ];

  return (
    <div className="auth-container">
      <div className="auth-glow-circle circle-1"></div>
      <div className="auth-glow-circle circle-2"></div>
      <div className="auth-glow-circle circle-3"></div>
      <div className="auth-card glass">
        <div className="auth-header">
          <div className="auth-logo">
            <PiggyBank size={48} className="logo-icon animate-pulse" />
          </div>
          <h1>SpreeTail Split</h1>
          <p className="auth-subtitle">Settle expenses and chat in real-time</p>
        </div>

        {/* Tab Selection */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(null); }}
          >
            Log In
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(null); }}
          >
            Register
          </button>
        </div>

        {/* Error Message Alert */}
        {error && (
          <div className="auth-error-alert animate-shake">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input 
                  type="text" 
                  id="name"
                  name="name"
                  placeholder="Enter your name" 
                  value={formData.name}
                  onChange={handleInputChange}
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                id="email"
                name="email"
                placeholder="you@example.com" 
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input 
                type="password" 
                id="password"
                name="password"
                placeholder="••••••••" 
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>

        {/* Quick Demo Accounts widget */}
        <div className="demo-accounts-box">
          <span className="demo-title">Quick Demo Login:</span>
          <div className="demo-buttons-grid">
            {demoAccounts.map(account => (
              <button 
                key={account.email} 
                onClick={() => handleDemoLogin(account.email)}
                className="btn btn-secondary btn-sm"
                disabled={submitting}
              >
                <span>{account.name}</span>
                <ArrowRight size={12} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginRegister;
