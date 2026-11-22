import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Zap } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, phone, password);
      navigate('/join');
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
        <p style={{ marginTop: '6px' }}>Create your resident account</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input type="text" className="form-input" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Phone (optional)</label>
          <input type="tel" className="form-input" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input type="password" className="form-input" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <div className="auth-divider">already have an account?</div>
        <Link to="/login">
          <button type="button" className="btn btn-secondary btn-block">Sign In</button>
        </Link>
      </form>
    </div>
  );
}
