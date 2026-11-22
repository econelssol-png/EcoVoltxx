import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X, Check } from 'lucide-react';
import adminApi from '../services/api';

export default function RefundModal({ isOpen, onClose, payment, showToast, onSuccess }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(payment?.amount || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !payment) return null;

  const handleRefund = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.refundPayment(payment.id, {
        reason: reason || 'Society Administrator refund',
        amount: parseFloat(amount) || parseFloat(payment.amount),
      });
      showToast(`Refund of ₹${amount || payment.amount} processed successfully!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(err.message || 'Refund processing failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: '#141e33',
        borderRadius: '16px',
        border: '1px solid #1e293b',
        width: '100%',
        maxWidth: '460px',
        padding: '24px',
        color: '#f8fafc',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                Issue Payment Refund
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Ref: {payment.transaction_reference} · Resident: {payment.user_name}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleRefund}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '0.82rem',
            color: '#fca5a5',
            lineHeight: 1.5,
          }}>
            <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Refunding will mark this payment record as <strong>Refunded</strong> in society books and notify resident <strong>{payment.user_name}</strong>.
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#f8fafc' }}>
              Refund Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              max={payment.amount}
              className="form-input"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Maximum refundable amount: ₹{parseFloat(payment.amount).toFixed(2)}
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#f8fafc' }}>
              Reason for Refund
            </label>
            <textarea
              rows="3"
              className="form-textarea"
              placeholder="e.g. Inadvertent duplicate booking charge, charger tripped mid-session, or billing correction"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 2, background: '#ef4444', borderColor: '#ef4444' }}
            >
              {loading ? 'Processing...' : 'Confirm & Issue Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
