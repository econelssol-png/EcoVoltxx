import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
        <Zap size={48} style={{ color: '#00A651', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 20px rgba(0,166,81,0.5))' }} />
        <h1>EcoVoltX</h1>
        <div className="powered-by-tag">
          Powered by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
        </div>
        <p style={{ marginTop: '6px' }}>Smart EV Charging for Residential Societies</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input type="password" className="form-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{ marginTop: '14px' }}>
          <button
            type="button"
            className="btn btn-block"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 166, 81, 0.15) 0%, rgba(0, 102, 204, 0.15) 100%)',
              border: '1px solid #00A651',
              color: '#34d399',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onClick={() => navigate('/public')}
          >
            ⚡ 24/7 Open Public Charging (No Login)
          </button>
        </div>

        <div className="auth-divider">or resident registration</div>

        <Link to="/register">
          <button type="button" className="btn btn-secondary btn-block">Join Society / Create Account</button>
        </Link>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Demo Credentials:</strong><br />
          Resident: rahul@test.com / password123<br />
          Admin: admin_gvr@test.com / password123<br />
          Super Admin: superadmin@societycharge.com / password123
        </div>
      </form>
    </div>
  );
}
