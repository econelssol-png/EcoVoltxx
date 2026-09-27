import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Search, Building2 } from 'lucide-react';
import api from '../services/api';

export default function JoinSociety() {
  const [code, setCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [foundSociety, setFoundSociety] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { selectSociety, logout } = useAuth();
  const navigate = useNavigate();

  const handleLookup = async () => {
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.lookupSociety(code.trim());
      setFoundSociety(data.society);
    } catch (err) {
      setError(err.message);
      setFoundSociety(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!foundSociety) return;
    setError('');
    setLoading(true);
    try {
      await api.joinSociety(foundSociety.id, code.trim(), flatNumber);
      selectSociety({
        id: foundSociety.id,
        name: foundSociety.name,
        code: foundSociety.code,
        member_role: 'resident',
        flat_number: flatNumber,
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <Building2 size={48} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }} />
        <h1>Join a Society</h1>
        <p>Enter your society's invitation code</p>
      </div>

      <div className="auth-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label className="form-label">Society Code</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" className="form-input" placeholder="e.g. GVR2024" value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={handleLookup} disabled={loading}>
              <Search size={18} />
            </button>
          </div>
        </div>

        {foundSociety && (
          <div style={{ animation: 'slideUp 0.3s ease' }}>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: 'var(--font-md)', marginBottom: '4px' }}>{foundSociety.name}</h3>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                {foundSociety.address}, {foundSociety.city}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Your Flat/Apartment Number</label>
              <input type="text" className="form-input" placeholder="e.g. A-101" value={flatNumber} onChange={e => setFlatNumber(e.target.value)} />
            </div>

            <button className="btn btn-primary btn-block" onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining...' : 'Join Society'}
            </button>
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={logout} style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
            Sign out
          </button>
        </div>

        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Demo Codes:</strong><br />
          Green Valley: GVR2024<br />
          Sunrise Towers: SRT2024
        </div>
      </div>
    </div>
  );
}
