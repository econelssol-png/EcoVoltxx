import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

const MIN_LENGTH = 8;

/**
 * Bottom sheet for changing the signed-in resident's password.
 * Mount it only while open, so the fields start empty each time.
 */
export default function ChangePasswordSheet({ onClose, onChanged }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < MIN_LENGTH) return setError(`New password must be at least ${MIN_LENGTH} characters`);
    if (next !== confirm) return setError('The new passwords do not match');

    setBusy(true);
    try {
      await api.changePassword(current, next);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cp-title">
        <div className="modal-header">
          <h2 id="cp-title">Change password</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-current">Current password</label>
            <input id="cp-current" type="password" className="form-input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-new">New password</label>
            <input id="cp-new" type="password" className="form-input" autoComplete="new-password" minLength={MIN_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} required />
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>At least {MIN_LENGTH} characters</div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-confirm">Repeat new password</label>
            <input id="cp-confirm" type="password" className="form-input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
