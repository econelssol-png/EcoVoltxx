import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [guestPhone, setGuestPhone] = useState('9876543210');
  const [guestVehicle, setGuestVehicle] = useState('KA-01-EV-2024');
  const [guestName, setGuestName] = useState('Guest Driver');
  const [liveKwh, setLiveKwh] = useState(0);
  const [receipt, setReceipt] = useState(null);

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

  // Live kWh meter ticker for active guest session
  useEffect(() => {
    if (!activeGuestSession) return;
    const tick = setInterval(() => {
      setLiveKwh(prev => parseFloat((prev + 0.12).toFixed(2)));
    }, 1500);
    return () => clearInterval(tick);
  }, [activeGuestSession]);

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
      if (!res.ok) throw new Error(data.error || 'Failed to start charge');

      setActiveGuestSession(data.session);
      setShowStartModal(false);
      setLiveKwh(0.8);
      fetchPublicChargers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStopPublicCharge = async () => {
    if (!activeGuestSession) return;
    try {
      const res = await fetch('/api/public/charge/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeGuestSession.id }),
      });
      const data = await res.json();
      setActiveGuestSession(null);
      setReceipt(data.receipt);
      fetchPublicChargers();
    } catch (err) {
      alert(err.message);
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
          No society registration or admin approval. Pick a free charger, enter your phone number and vehicle plate, then pay by UPI when you stop.
        </p>
      </div>

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
                {liveKwh} <span style={{ fontSize: '0.8rem' }}>kWh</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Estimated cost</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 500, color: '#8fe3b0', fontFamily: 'var(--font-mono)' }}>
                ₹{(liveKwh * 8.0).toFixed(2)}
              </div>
            </div>
          </div>

          <button
            className="btn btn-danger btn-block"
            onClick={handleStopPublicCharge}
            style={{ fontWeight: 500 }}
          >
            <Square size={16} fill="white" /> Stop & Finalize Public Charge
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>UPI receipt from EcoVoltX</p>
          <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
            <div>Total energy <strong>{receipt.energy_kwh} kWh</strong></div>
            <div style={{ color: '#00A651', fontSize: '1.2rem', fontWeight: 500, margin: '6px 0' }}>Paid: ₹{receipt.total_cost}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹{receipt.rate}/kWh</div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setReceipt(null)}>
            Close Receipt
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
                <label className="form-label">Phone number for the SMS receipt</label>
                <input
                  type="tel"
                  className="form-input"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle registration plate</label>
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
                style={{ background: '#00A651', borderColor: '#00A651', marginTop: '10px' }}
              >
                <Zap size={16} /> Connect & Begin 24/7 Charging
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
