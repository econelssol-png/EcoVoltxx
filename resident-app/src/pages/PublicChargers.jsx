import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PolicyLinks from '../components/PolicyLinks';
import {
  Zap,
  MapPin,
  Clock,
  ArrowLeft,
  CheckCircle,
  BatteryCharging,
  DollarSign,
  Shield,
  Phone,
  Car,
  Play,
  Square,
  Sparkles
} from 'lucide-react';

export default function PublicChargers() {
  const navigate = useNavigate();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGuestSession, setActiveGuestSession] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [guestPhone, setGuestPhone] = useState('');
  const [guestVehicle, setGuestVehicle] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestToken, setGuestToken] = useState(null);
  const [liveKwh, setLiveKwh] = useState(0);
  const [liveCost, setLiveCost] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [actionError, setActionError] = useState('');

  // The stop token proves this browser started the session; keep it across reloads
  const SAVED_KEY = 'ecovoltx_visitor_session';
  const saveSession = (id, token) => {
    try {
      if (id && token) localStorage.setItem(SAVED_KEY, JSON.stringify({ id, token }));
      else localStorage.removeItem(SAVED_KEY);
    } catch {}
  };

  const fetchPublicChargers = async () => {
    try {
      const res = await fetch('/api/public/chargers');
      const data = await res.json();
      setChargers(data.chargers || []);
    } catch (err) {
      console.error('Fetch public chargers error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicChargers();
    const interval = setInterval(fetchPublicChargers, 6000);
    return () => clearInterval(interval);
  }, []);

  // Restore a session this browser started earlier
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null');
      if (saved?.id && saved?.token) {
        setActiveGuestSession({ id: saved.id });
        setGuestToken(saved.token);
      }
    } catch {}
  }, []);

  // Real meter readings from the server (no made-up numbers)
  useEffect(() => {
    if (!activeGuestSession || !guestToken) return;
    let stopped = false;
    const poll = async () => {
      try {
        const qs = new URLSearchParams({ session_id: activeGuestSession.id, stop_token: guestToken });
        const res = await fetch(`/api/public/charge/status?${qs}`);
        if (stopped) return;
        if (res.status === 404) {
          setActiveGuestSession(null);
          setGuestToken(null);
          saveSession(null);
          return;
        }
        const data = await res.json();
        if (!res.ok || !data.session) return;
        setLiveKwh(Number(data.session.energy_kwh || 0));
        setLiveCost(Number(data.session.cost || 0));
        if (data.session.status !== 'active') {
          setActiveGuestSession(null);
          setGuestToken(null);
          saveSession(null);
          fetchPublicChargers();
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [activeGuestSession, guestToken]);

  const handleStartPublicCharge = async (e) => {
    e.preventDefault();
    if (!selectedCharger) return;

    try {
      const res = await fetch('/api/public/charge/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charger_id: selectedCharger.id,
          phone: guestPhone,
          vehicle_number: guestVehicle,
          driver_name: guestName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start charging');

      setActiveGuestSession(data.session);
      setGuestToken(data.stop_token);
      saveSession(data.session.id, data.stop_token);
      setShowStartModal(false);
      setActionError('');
      setLiveKwh(0);
      setLiveCost(0);
      fetchPublicChargers();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleStopPublicCharge = async () => {
    if (!activeGuestSession) return;
    try {
      const res = await fetch('/api/public/charge/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeGuestSession.id, stop_token: guestToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not stop charging');
      setActiveGuestSession(null);
      setGuestToken(null);
      saveSession(null);
      setActionError('');
      setReceipt(data.receipt);
      fetchPublicChargers();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/login')} style={{ padding: '6px' }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Public chargers
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
          </div>
        </div>
        <div style={{ width: '32px' }} />
      </div>

      {/* Network Live Badge */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
      }}>
        <div className="status-badge available" style={{ marginBottom: '8px', textTransform: 'none' }}>
          <span className="status-dot available" /> Open at all hours
        </div>
        <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Charge without an account
        </h3>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          No society registration or admin approval. Pick a free charger and enter your mobile and vehicle number. When you stop, you get a receipt with the amount due.
        </p>
      </div>

      {actionError && (
        <div className="error-message" role="alert">{actionError}</div>
      )}

      {/* Active Guest Charging Session Widget */}
      {activeGuestSession && (
        <div style={{
          background: 'linear-gradient(180deg, #0f1611 0%, #0c120e 100%)',
          border: '1px solid #00A651',
          borderRadius: '14px',
          padding: '20px',
          marginBottom: '24px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BatteryCharging size={22} color="#8fe3b0" strokeWidth={1.5} />
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '1rem' }}>Visitor charging session</span>
            </div>
            <span className="badge badge-charging">Charging</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Energy delivered</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {liveKwh.toFixed(3)} <span style={{ fontSize: '0.8rem' }}>kWh</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cost so far</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 500, color: '#8fe3b0', fontFamily: 'var(--font-mono)' }}>
                ₹{liveCost.toFixed(2)}
              </div>
            </div>
          </div>

          <button
            className="btn btn-danger btn-block"
            onClick={handleStopPublicCharge}
            style={{ fontWeight: 500 }}
          >
            <Square size={16} strokeWidth={1.5} /> Stop charging
          </button>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {receipt && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid #00A651',
          borderRadius: '14px',
          padding: '20px',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          <CheckCircle size={36} color="#00A651" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 500 }}>Charging complete</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>Visitor charging receipt</p>
          <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
            <div>Total energy <strong>{receipt.energy_kwh} kWh</strong></div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 500, margin: '6px 0' }}>Amount due: ₹{Number(receipt.amount_due ?? receipt.total_cost ?? 0).toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹{receipt.rate}/kWh</div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setReceipt(null)}>
            Close receipt
          </button>
        </div>
      )}

      {/* Chargers List */}
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Chargers <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{chargers.filter(c => c.status === 'available').length} free of {chargers.length}</span>
        </h4>
        <button onClick={fetchPublicChargers} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.78rem', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {chargers.map(charger => (
          <div
            key={charger.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '18px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  <span className="bay">{charger.charger_number}</span> {charger.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {charger.society_name}, {charger.society_city}
                </div>
              </div>
              <span className={`status-badge ${charger.status}`}>
                <span className={`status-dot ${charger.status}`} />
                {charger.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', marginBottom: '14px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Power</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{charger.power_rating_kw ?? charger.power_output_kw} kW</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Connector</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{charger.connector_type}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rate</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#00A651' }}>₹{charger.price_per_kwh}/kWh</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {charger.parking_location || charger.location_description}
              </div>
              {charger.status === 'available' ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setSelectedCharger(charger);
                    setShowStartModal(true);
                  }}
                >
                  <Play size={14} strokeWidth={1.5} /> Start charging
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" disabled>
                  {charger.status === 'charging' ? 'In use' : 'Offline'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Start Charge Modal */}
      {showStartModal && selectedCharger && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Start a visitor charge
              </h3>
              <button className="modal-close" onClick={() => setShowStartModal(false)}>✕</button>
            </div>

            <form onSubmit={handleStartPublicCharge}>
              <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}><span className="bay">{selectedCharger.charger_number}</span> {selectedCharger.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{selectedCharger.society_name} • Rate: ₹{selectedCharger.price_per_kwh}/kWh</div>
              </div>

              <div className="form-group">
                <label className="form-label">Your name</label>
                <input
                  className="form-input"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle registration number</label>
                <input
                  className="form-input"
                  value={guestVehicle}
                  onChange={e => setGuestVehicle(e.target.value)}
                  placeholder="e.g. KA-01-EV-4321"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: '10px' }}
              >
                <Zap size={16} strokeWidth={1.5} /> Start charging
              </button>
            </form>
          </div>
        </div>
      )}

      <PolicyLinks style={{ marginTop: '32px', paddingBottom: '16px' }} />
    </div>
  );
}
