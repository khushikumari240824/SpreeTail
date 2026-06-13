// src/pages/SettlementLog.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCents } from '../utils/format';
import { Receipt, Calendar, ArrowRight, UserCheck } from 'lucide-react';

const SettlementLog = () => {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSettlements = async () => {
    setLoading(true);
    try {
      const data = await api.settlements.list();
      setSettlements(data);
    } catch (err) {
      console.error('Error fetching settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, []);

  if (loading) return <div className="loading-state">Loading settlements history...</div>;

  return (
    <div className="settlements-container page-layout">
      <header className="page-header">
        <div>
          <h1>Settlements Log</h1>
          <p className="subtitle">History of recorded debt repayments</p>
        </div>
      </header>

      {settlements.length === 0 ? (
        <div className="empty-state-box glass">
          <Receipt size={48} className="empty-icon" />
          <h4>No settlements recorded</h4>
          <p>Go to your groups and click "Settle Up" to record a repayment!</p>
        </div>
      ) : (
        <div className="settlements-list glass">
          {settlements.map((set) => (
            <div key={set.id} className="settlement-log-item hover-card">
              <div className="log-icon-badge">
                <UserCheck size={20} className="text-success" />
              </div>

              <div className="settlement-flow-detail">
                <div className="flow-users">
                  <span className="user-bold">{set.payer_name}</span>
                  <span className="payment-arrow"><ArrowRight size={14} /> paid</span>
                  <span className="user-bold">{set.receiver_name}</span>
                </div>
                <div className="settlement-notes-date">
                  <span className="log-notes">"{set.notes}"</span>
                  <span className="log-date">
                    <Calendar size={12} />
                    {new Date(set.settlement_date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="settlement-cost">
                {formatCents(set.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SettlementLog;
