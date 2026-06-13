// src/pages/ExpenseDetails.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatCents, formatCategory } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Send, MessageSquare, Info, Calendar, User, ShoppingBag } from 'lucide-react';

const ExpenseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [expense, setExpense] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const messagesEndRef = useRef(null);

  const loadExpenseData = async () => {
    try {
      const exp = await api.expenses.getById(id);
      setExpense(exp);
      
      const chatHistory = await api.chat.getMessages(id);
      setMessages(chatHistory);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error loading expense.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenseData();
  }, [id]);

  // Listener for mock incoming messages to simulate real-time sockets
  useEffect(() => {
    const handleMockMessage = (event) => {
      const incoming = event.detail;
      if (incoming.expense_id === parseInt(id)) {
        setMessages(prev => [...prev, incoming]);
      }
    };

    window.addEventListener('st_mock_message_received', handleMockMessage);
    return () => {
      window.removeEventListener('st_mock_message_received', handleMockMessage);
    };
  }, [id]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const msg = await api.chat.sendMessage(id, newMessage.trim());
      // For mock mode,sendMessage returns the message directly.
      // For real mode, we wait for socket to broadcast, but here we append it
      if (msg && msg.id) {
        setMessages(prev => [...prev, msg]);
      }
      setNewMessage('');
    } catch (err) {
      alert('Failed to send message.');
    }
  };

  if (loading) return <div className="loading-state">Loading expense details...</div>;
  if (errorMsg || !expense) {
    return (
      <div className="error-state">
        <h3>Error</h3>
        <p>{errorMsg || 'Expense not found'}</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Go Back</button>
      </div>
    );
  }

  return (
    <div className="expense-details-container page-layout">
      {/* Header */}
      <header className="page-header glass">
        <div className="header-nav-title">
          <button className="back-link btn-link" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <h2>{expense.description}</h2>
        </div>
        <div className="category-badge">
          <ShoppingBag size={14} />
          <span>{formatCategory(expense.category)}</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="expense-workspace">
        {/* Left Side: Details & Splits */}
        <section className="expense-info-panel glass">
          <div className="expense-overview-row">
            <div className="expense-stat">
              <span className="label">Total Cost</span>
              <h1 className="cost-value">{formatCents(expense.amount)}</h1>
            </div>
            <div className="expense-meta-details">
              <div className="meta-item">
                <User size={16} className="text-accent" />
                <span>Paid by: <strong>{expense.paid_by === user.id ? 'You' : expense.payer_name}</strong></span>
              </div>
              <div className="meta-item">
                <Calendar size={16} className="text-accent" />
                <span>Date: <strong>{new Date(expense.expense_date).toLocaleDateString()}</strong></span>
              </div>
            </div>
          </div>

          {expense.notes && (
            <div className="expense-notes-box">
              <h5><Info size={14} /> Notes</h5>
              <p>{expense.notes}</p>
            </div>
          )}

          {/* Splits Breakdown */}
          <div className="splits-breakdown-section">
            <h3>Shares Breakdown</h3>
            <div className="splits-ledger-list">
              {expense.splits?.map(split => {
                const isUserPayer = expense.paid_by === split.user_id;
                const isMe = split.user_id === user.id;

                return (
                  <div key={split.user_id} className={`split-ledger-row ${isMe ? 'highlighted' : ''}`}>
                    <div className="split-member-info">
                      <div className="avatar avatar-xs">
                        {split.user_name?.charAt(0).toUpperCase()}
                      </div>
                      <span>{split.user_name} {isMe && '(You)'}</span>
                    </div>

                    <div className="split-calculations">
                      {isUserPayer ? (
                        <span className="split-amount text-emerald">
                          Paid {formatCents(expense.amount)} and owes {formatCents(split.amount_owed)}
                        </span>
                      ) : (
                        <span className="split-amount text-amber">
                          Owes {formatCents(split.amount_owed)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Side: Expense Chat Room */}
        <section className="expense-chat-panel glass">
          <div className="chat-header">
            <MessageSquare size={18} />
            <h3>Expense Discussion</h3>
          </div>

          {/* Message History List */}
          <div className="chat-messages-box">
            {messages.length === 0 ? (
              <div className="empty-chat-box">
                <p>No messages yet. Ask a question or start a discussion!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMyMessage = msg.user_id === user.id;
                return (
                  <div key={msg.id} className={`chat-message-bubble ${isMyMessage ? 'outgoing' : 'incoming'}`}>
                    <div className="msg-sender-name">{msg.user_name}</div>
                    <div className="msg-body">
                      <p>{msg.message}</p>
                      <span className="msg-timestamp">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Form */}
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input 
              type="text" 
              placeholder="Post a reply..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-icon btn-send">
              <Send size={16} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ExpenseDetails;
