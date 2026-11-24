import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import adminApi from '../services/api';

const MIN_LENGTH = 8;

export default function ChangePasswordModal({ isOpen, onClose, showToast }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < MIN_LENGTH) return setError(`New password must be at least ${MIN_LENGTH} characters`);
    if (next !== confirm) return setError('The new passwords do not match');

    setBusy(true);
    try {
      await adminApi.changePassword(current, next);
      showToast('Password changed. Other devices are signed out within an hour');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="change-password-title">
        <div className="modal-header">
          <h3 id="change-password-title" style={{ fontSize: '16px', fontWeight: 500 }}>Change password</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {error && (
          <div role="alert" style={{ background: 'rgba(229, 72, 77, 0.12)', border: '1px solid rgba(229, 72, 77, 0.32)', color: '#f2a3a5', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-current">Current password</label>
            <input id="cp-current" type="password" className="form-input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-new">New password</label>
            <input id="cp-new" type="password" className="form-input" autoComplete="new-password" minLength={MIN_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} required />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>At least {MIN_LENGTH} characters</div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-confirm">Repeat new password</label>
            <input id="cp-confirm" type="password" className="form-input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Change password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
