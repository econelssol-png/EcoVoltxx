import React, { useState } from 'react';
import { Zap, LogIn, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Admin sign-in screen.
 * Demo quick-login buttons are only shown when the server runs in DEMO_MODE.
 */
export default function LoginScreen({ onLogin, demoMode, demoAccounts = [] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (loginEmail, loginPassword) => {
    setError('');
    setBusy(true);
    try {
      await onLogin(loginEmail, loginPassword);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(email.trim(), password);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '32px 28px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div className="brand-icon">
            <Zap size={22} fill="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="brand-title">EcoVoltX</span>
              <span className="brand-badge">Admin</span>
            </div>
            <div className="powered-by-badge">
              Powered by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
            </div>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '18px 0 22px' }}>
          Sign in with a society admin or super admin account.
        </p>

        {error && (
          <div role="alert" style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.85rem',
            marginBottom: '16px',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              className="form-input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              className="form-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
          >
            {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Sign In
          </button>
        </form>

        {demoMode && demoAccounts.length > 0 && (
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '10px' }}>
              Demo mode · quick sign-in
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="demo-btn"
                  disabled={busy}
                  onClick={() => submit(acc.email, acc.password)}
                  style={{ textAlign: 'left' }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
