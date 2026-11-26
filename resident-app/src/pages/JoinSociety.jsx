import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Search, Zap } from 'lucide-react';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function JoinSociety() {
  const [code, setCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [foundSociety, setFoundSociety] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState([]); // join requests waiting for approval
  const [notice, setNotice] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const { selectSociety, setMemberships, logout } = useAuth();
  const navigate = useNavigate();

  const loadPending = async () => {
    try {
      const data = await api.getProfile();
      setPending((data.memberships || []).filter((m) => m.status === 'pending'));
    } catch {}
  };

  useEffect(() => {
    loadPending();
    fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((info) => setDemoMode(Boolean(info.demo_mode)))
      .catch(() => {});
  }, []);

  const enterApprovedSociety = (memberships) => {
    const s = memberships[0];
    setMemberships?.(memberships);
    selectSociety({
      id: s.society_id,
      name: s.society_name,
      code: s.society_code,
      member_role: s.member_role,
      flat_number: s.flat_number,
    });
    navigate('/');
  };

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

  const handleJoin = async (e) => {
    e?.preventDefault();
    if (!foundSociety) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.joinSociety(foundSociety.id, code.trim(), flatNumber.trim());
      if (data.membership?.status === 'approved') {
        const me = await api.getMe();
        if (me.memberships?.length) return enterApprovedSociety(me.memberships);
      }
      setPending([{ society_id: foundSociety.id, society_name: foundSociety.name, flat_number: flatNumber.trim() }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAgain = async () => {
    setNotice('');
    setLoading(true);
    try {
      const me = await api.getMe();
      if (me.memberships?.length) return enterApprovedSociety(me.memberships);
      await loadPending();
      setNotice('Not approved yet. Check again later, or ask your society admin');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  };

  const brand = (
    <div className="brand-row" style={{ marginBottom: '32px' }}>
      <Zap size={16} className="mark" fill="currentColor" strokeWidth={0} />
      EcoVoltX
    </div>
  );

  // ── Waiting for the society admin ──────────────────────
  if (pending.length > 0) {
    const p = pending[0];
    return (
      <div className="auth-page">
        <div className="auth-logo">
          {brand}
          <h1>Waiting for approval</h1>
          <p>
            Your request to join {p.society_name}{p.flat_number ? `, flat ${p.flat_number},` : ''} has been sent.
            You can use the app as soon as the society admin approves it.
          </p>
        </div>

        <div className="auth-form">
          {notice && <p role="status" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: '16px' }}>{notice}</p>}
          <button className="btn btn-primary btn-block" onClick={checkAgain} disabled={loading}>
            {loading ? 'Checking' : 'Check again'}
          </button>
          <button className="btn btn-secondary btn-block" style={{ marginTop: '12px' }} onClick={() => navigate('/public')}>
            Charge as a visitor meanwhile
          </button>
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button className="btn btn-ghost" onClick={logout} style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Join form ───────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-logo">
        {brand}
        <h1>Join your society</h1>
        <p>Enter the join code your society shared with you</p>
      </div>

      <div className="auth-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="join-code">Join code</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="join-code"
              type="text"
              className="form-input mono"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setFoundSociety(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } }}
              autoCapitalize="characters"
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={handleLookup} disabled={loading} aria-label="Find society">
              <Search size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {foundSociety && (
          <form onSubmit={handleJoin}>
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 500, marginBottom: '4px' }}>{foundSociety.name}</h3>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                {[foundSociety.address, foundSociety.city].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="join-flat">Flat number</label>
              <input id="join-flat" type="text" className="form-input" placeholder="e.g. A-101" value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} required />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Sending request' : 'Request to join'}
            </button>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '8px' }}>
              The society admin approves new residents before they can charge
            </p>
          </form>
        )}

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={logout} style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
            Sign out
          </button>
        </div>

        {demoMode && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            Demo codes: <span className="mono">GVR2024</span> (Green Valley), <span className="mono">SRT2024</span> (Sunrise Towers)
          </div>
        )}
      </div>
    </div>
  );
}
