import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Zap } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Demo logins are only shown when the server runs with DEMO_MODE on
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((info) => { if (active) setDemoMode(Boolean(info.demo_mode)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.memberships?.length > 0) {
        navigate('/');
      } else {
        navigate('/join');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <div className="brand-row" style={{ marginBottom: '32px' }}>
          <Zap size={16} className="mark" fill="currentColor" strokeWidth={0} />
          EcoVoltX
          <span className="powered-by-tag">
            by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
          </span>
        </div>
        <h1>Sign in to charge in your society’s parking</h1>
        <p>Use the email you registered with your society</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" className="form-input" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" className="form-input" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Signing in' : 'Sign in'}
        </button>

        <Link to="/register">
          <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: '12px' }}>Join your society</button>
        </Link>

        <div className="auth-divider">or</div>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ height: '44px' }}
          onClick={() => navigate('/public')}
        >
          Charge as a visitor, no account needed
        </button>

        {demoMode && (
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
            <div style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Demo accounts, password <span className="mono">password123</span></div>
            <div className="mono" style={{ fontSize: 'var(--font-xs)', lineHeight: '20px', color: 'var(--text-muted)' }}>
              rahul@test.com · resident<br />
              admin_gvr@test.com · society admin<br />
              superadmin@societycharge.com · super admin
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
