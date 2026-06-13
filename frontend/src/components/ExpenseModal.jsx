// src/components/ExpenseModal.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCents } from '../utils/format';
import { X, Calendar, AlertCircle, Sparkles } from 'lucide-react';

const ExpenseModal = ({ isOpen, onClose, groupId, members, expenseToEdit, onSave }) => {
  if (!isOpen) return null;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(''); // dollar string
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [category, setCategory] = useState('food');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Track who is participating (array of userIds)
  const [participants, setParticipants] = useState([]);
  
  // Track inputs for unequal (dollars), percentage (number), shares (integer)
  // Format: { [userId]: value }
  const [splitDetails, setSplitDetails] = useState({});
  const [errorMsg, setErrorMsg] = useState(null);
  const [liveSplits, setLiveSplits] = useState([]);

  const categories = ['food', 'travel', 'rent', 'utilities', 'entertainment', 'other'];

  // Initialize form
  useEffect(() => {
    if (expenseToEdit) {
      setDescription(expenseToEdit.description || '');
      setAmount((expenseToEdit.amount / 100).toString() || '');
      setPaidBy(expenseToEdit.paid_by?.toString() || '');
      setSplitType(expenseToEdit.split_type || 'equal');
      setCategory(expenseToEdit.category || 'food');
      setExpenseDate(expenseToEdit.expense_date ? expenseToEdit.expense_date.split('T')[0] : '');
      setNotes(expenseToEdit.notes || '');

      // Load participants and details
      const parts = expenseToEdit.splits?.map(s => s.user_id) || [];
      setParticipants(parts);

      const details = {};
      expenseToEdit.splits?.forEach(s => {
        if (expenseToEdit.split_type === 'equal') {
          details[s.user_id] = true;
        } else if (expenseToEdit.split_type === 'unequal') {
          details[s.user_id] = (s.amount_owed / 100).toString();
        } else {
          // percentage or share was stored differently in backend, but we mock/restore details
          // For simplicity, we fallback to equal or calculate percentages based on amount
          if (expenseToEdit.split_type === 'percentage') {
            details[s.user_id] = ((s.amount_owed / expenseToEdit.amount) * 100).toFixed(1);
          } else if (expenseToEdit.split_type === 'share') {
            // Reconstruct as 1 share per member
            details[s.user_id] = '1';
          }
        }
      });
      setSplitDetails(details);
    } else {
      // Defaults
      setDescription('');
      setAmount('');
      setPaidBy(members[0]?.user_id?.toString() || '');
      setSplitType('equal');
      setCategory('food');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      
      // Default participants: all members
      const allIds = members.map(m => m.user_id);
      setParticipants(allIds);
      
      const details = {};
      allIds.forEach(id => {
        details[id] = '1'; // Default share/percentage
      });
      setSplitDetails(details);
    }
    setErrorMsg(null);
  }, [expenseToEdit, members, isOpen]);

  // Recalculate Live Splits for preview
  useEffect(() => {
    const amtCents = Math.round(parseFloat(amount || 0) * 100);
    if (isNaN(amtCents) || amtCents <= 0 || participants.length === 0) {
      setLiveSplits([]);
      return;
    }

    try {
      let calcDetails = {};
      if (splitType === 'equal') {
        participants.forEach(id => {
          calcDetails[id] = 1;
        });
      } else if (splitType === 'unequal') {
        participants.forEach(id => {
          calcDetails[id] = Math.round(parseFloat(splitDetails[id] || 0) * 100);
        });
      } else if (splitType === 'percentage') {
        participants.forEach(id => {
          calcDetails[id] = parseFloat(splitDetails[id] || 0);
        });
      } else if (splitType === 'share') {
        participants.forEach(id => {
          calcDetails[id] = parseInt(splitDetails[id] || 0);
        });
      }

      // Perform calculations
      let typeToCalc = splitType;
      if (splitType === 'equal') typeToCalc = 'equal'; // Maps directly

      const resultSplits = calculateMockLiveSplits(amtCents, typeToCalc, participants, calcDetails);
      setLiveSplits(resultSplits);
      setErrorMsg(null);
    } catch (err) {
      setLiveSplits([]);
      // We don't block input edits with full error, but we track validation status
    }
  }, [amount, splitType, participants, splitDetails]);

  // Mock splitting calculation matching backend rounding logic
  const calculateMockLiveSplits = (amountCents, splitType, participantsList, detailsMap) => {
    const num = participantsList.length;
    if (num === 0) return [];
    
    if (splitType === 'equal') {
      const base = Math.floor(amountCents / num);
      const rem = amountCents - (base * num);
      return participantsList.map((id, idx) => ({
        user_id: id,
        amount_owed: base + (idx === 0 ? rem : 0)
      }));
    } 
    else if (splitType === 'unequal') {
      let sum = 0;
      const res = participantsList.map(id => {
        const val = detailsMap[id] || 0;
        sum += val;
        return { user_id: id, amount_owed: val };
      });
      return res;
    } 
    else if (splitType === 'percentage') {
      let sum = 0;
      let calculatedSum = 0;
      const baseSplits = participantsList.map(id => {
        const pct = detailsMap[id] || 0;
        sum += pct;
        const owed = Math.floor((amountCents * pct) / 100);
        calculatedSum += owed;
        return { user_id: id, amount_owed: owed };
      });
      const rem = amountCents - calculatedSum;
      if (baseSplits.length > 0) {
        baseSplits[0].amount_owed += rem;
      }
      return baseSplits;
    } 
    else if (splitType === 'share') {
      let totalShares = 0;
      participantsList.forEach(id => {
        totalShares += detailsMap[id] || 0;
      });
      if (totalShares <= 0) return [];

      let calculatedSum = 0;
      const baseSplits = participantsList.map(id => {
        const sh = detailsMap[id] || 0;
        const owed = Math.floor((amountCents * sh) / totalShares);
        calculatedSum += owed;
        return { user_id: id, amount_owed: owed };
      });

      const rem = amountCents - calculatedSum;
      const firstActiveIdx = participantsList.findIndex(id => (detailsMap[id] || 0) > 0);
      if (firstActiveIdx !== -1) {
        baseSplits[firstActiveIdx].amount_owed += rem;
      } else if (baseSplits.length > 0) {
        baseSplits[0].amount_owed += rem;
      }
      return baseSplits;
    }
    return [];
  };

  const handleParticipantToggle = (userId) => {
    const isChecked = participants.includes(userId);
    let updated;
    if (isChecked) {
      // Remove from list unless it's the last participant
      if (participants.length === 1) return;
      updated = participants.filter(id => id !== userId);
    } else {
      updated = [...participants, userId];
    }
    setParticipants(updated);

    // Add default values for detail inputs
    if (!splitDetails[userId]) {
      setSplitDetails({
        ...splitDetails,
        [userId]: splitType === 'share' ? '1' : splitType === 'percentage' ? (100 / updated.length).toFixed(0) : '0'
      });
    }
  };

  const handleDetailChange = (userId, value) => {
    setSplitDetails({
      ...splitDetails,
      [userId]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setErrorMsg('Please enter a valid amount greater than $0.');
      return;
    }

    if (participants.length === 0) {
      setErrorMsg('Please select at least one participant.');
      return;
    }

    const amtCents = Math.round(parsedAmt * 100);
    
    // Prepare API format details
    let submissionDetails = {};
    
    // Validate sums
    if (splitType === 'unequal') {
      let sum = 0;
      participants.forEach(id => {
        const val = parseFloat(splitDetails[id] || 0);
        const valCents = Math.round(val * 100);
        submissionDetails[id] = valCents;
        sum += valCents;
      });

      if (sum !== amtCents) {
        setErrorMsg(`Splits total (${formatCents(sum)}) must match expense amount (${formatCents(amtCents)}). Difference: ${formatCents(amtCents - sum)}.`);
        return;
      }
    } 
    else if (splitType === 'percentage') {
      let sum = 0;
      participants.forEach(id => {
        const val = parseFloat(splitDetails[id] || 0);
        submissionDetails[id] = val;
        sum += val;
      });

      if (Math.abs(sum - 100) > 0.01) {
        setErrorMsg(`Percentages must add up to exactly 100% (currently ${sum}%).`);
        return;
      }
    } 
    else if (splitType === 'share') {
      let totalShares = 0;
      participants.forEach(id => {
        const val = parseInt(splitDetails[id] || 0);
        submissionDetails[id] = val;
        totalShares += val;
      });

      if (totalShares <= 0) {
        setErrorMsg('Total shares must be greater than 0.');
        return;
      }
    } 
    else {
      // Equal
      participants.forEach(id => {
        submissionDetails[id] = 1;
      });
    }

    const payload = {
      group_id: groupId,
      description,
      amount: amtCents,
      paid_by: parseInt(paidBy),
      split_type: splitType,
      category,
      expense_date: expenseDate,
      notes,
      participants,
      split_details: submissionDetails
    };

    try {
      if (expenseToEdit) {
        await api.expenses.update(expenseToEdit.id, payload);
      } else {
        await api.expenses.create(payload);
      }
      onSave();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error saving expense.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass expense-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>{expenseToEdit ? 'Edit Expense' : 'Add an Expense'}</h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </header>

        {errorMsg && (
          <div className="error-alert-box animate-shake">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="expense-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Description</label>
              <input 
                type="text" 
                placeholder="e.g. Groceries, Dinner, Electricity" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Amount ($)</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label>Paid By</label>
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date</label>
              <div className="date-input-wrapper">
                <Calendar size={16} className="date-icon" />
                <input 
                  type="date" 
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea 
              placeholder="Add details, receipt notes, etc. (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Splits Segment */}
          <div className="split-engine-section">
            <div className="split-tabs-header">
              <span className="split-section-title">Split Method:</span>
              <div className="split-method-tabs">
                {['equal', 'unequal', 'percentage', 'share'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`split-tab-btn ${splitType === method ? 'active' : ''}`}
                    onClick={() => setSplitType(method)}
                  >
                    {method.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Members List */}
            <div className="split-members-list">
              <span className="split-list-title">Split Among:</span>
              <div className="members-checkbox-grid">
                {members.map(m => {
                  const isChecked = participants.includes(m.user_id);
                  const isPayer = paidBy === m.user_id.toString();
                  return (
                    <div key={m.user_id} className={`split-member-row ${isChecked ? 'active' : ''}`}>
                      <label className="checkbox-container">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleParticipantToggle(m.user_id)}
                        />
                        <span className="checkmark"></span>
                        <span className="member-name-label">{m.name} {isPayer && <span className="payer-badge">(Payer)</span>}</span>
                      </label>

                      {/* Right Hand Input based on Split Mode */}
                      {isChecked && splitType !== 'equal' && (
                        <div className="split-input-subbox">
                          {splitType === 'unequal' && (
                            <>
                              <span className="subbox-symbol">$</span>
                              <input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                value={splitDetails[m.user_id] || ''}
                                onChange={(e) => handleDetailChange(m.user_id, e.target.value)}
                                required
                              />
                            </>
                          )}
                          {splitType === 'percentage' && (
                            <>
                              <input 
                                type="number" 
                                step="0.1" 
                                placeholder="0" 
                                value={splitDetails[m.user_id] || ''}
                                onChange={(e) => handleDetailChange(m.user_id, e.target.value)}
                                required
                              />
                              <span className="subbox-symbol">%</span>
                            </>
                          )}
                          {splitType === 'share' && (
                            <>
                              <input 
                                type="number" 
                                step="1" 
                                placeholder="1" 
                                value={splitDetails[m.user_id] || ''}
                                onChange={(e) => handleDetailChange(m.user_id, e.target.value)}
                                required
                              />
                              <span className="subbox-symbol">shares</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live splits display summary */}
          {liveSplits.length > 0 && (
            <div className="live-splits-preview glass">
              <h5><Sparkles size={14} className="preview-icon text-accent" /> Live Calculation Preview</h5>
              <div className="preview-items">
                {liveSplits.map(s => {
                  const name = members.find(m => m.user_id === s.user_id)?.name || 'User';
                  return (
                    <div key={s.user_id} className="preview-split-item">
                      <span className="p-name">{name}</span>
                      <span className="p-owes">{formatCents(s.amount_owed)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Expense</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseModal;
