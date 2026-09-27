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
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            ⚡ EcoVoltX 24/7 Network
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Powered by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
          </div>
        </div>
        <div style={{ width: '32px' }} />
      </div>

      {/* Network Live Badge */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 166, 81, 0.15) 0%, rgba(0, 102, 204, 0.15) 100%)',
        border: '1px solid rgba(0, 166, 81, 0.35)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#00A651', color: 'white', padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, marginBottom: '8px' }}>
          <span className="pulse" style={{ background: '#ffffff', width: '6px', height: '6px' }} /> 24/7 OPEN PUBLIC CHARGING
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
          Open Public EV Stations
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
          No society registration or admin approval needed. Plug in, tap start, and charge your EV 24 hours a day, 7 days a week.
        </p>
      </div>

      {/* Active Guest Charging Session Widget */}
      {activeGuestSession && (
        <div style={{
          background: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)',
          border: '1px solid #00A651',
          borderRadius: '14px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 0 25px rgba(0, 166, 81, 0.3)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BatteryCharging size={22} color="#00c761" />
              <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>Active 24/7 Guest Charge</span>
            </div>
            <span className="badge badge-charging">Charging</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Energy Delivered</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                {liveKwh} <span style={{ fontSize: '0.8rem' }}>kWh</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Estimated Cost</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00c761', fontFamily: 'monospace' }}>
                ₹{(liveKwh * 8.0).toFixed(2)}
              </div>
            </div>
          </div>

          <button
            className="btn btn-danger btn-block"
            onClick={handleStopPublicCharge}
            style={{ fontWeight: 700 }}
          >
            <Square size={16} fill="white" /> Stop & Finalize Public Charge
          </button>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {receipt && (
        <div style={{
          background: '#111a2e',
          border: '1px solid #00A651',
          borderRadius: '14px',
          padding: '20px',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          <CheckCircle size={36} color="#00A651" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 800 }}>Charging Complete!</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '14px' }}>Digital Receipt generated powered by EcoNelssol</p>
          <div style={{ background: '#070d19', padding: '14px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
            <div>Total Energy: <strong>{receipt.energy_kwh} kWh</strong></div>
            <div style={{ color: '#00A651', fontSize: '1.2rem', fontWeight: 800, margin: '6px 0' }}>Paid: ₹{receipt.total_cost}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rate: ₹{receipt.rate}/kWh • Instant UPI Receipt</div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setReceipt(null)}>
            Close Receipt
          </button>
        </div>
      )}

      {/* Chargers List */}
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
          Available 24/7 Stations ({chargers.filter(c => c.status === 'available').length} Online)
        </h4>
        <button onClick={fetchPublicChargers} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer' }}>
          Refresh ↻
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {chargers.map(charger => (
          <div
            key={charger.id}
            style={{
              background: '#111a2e',
              border: '1px solid #1e293b',
              borderRadius: '14px',
              padding: '18px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                  {charger.charger_number} — {charger.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                  <MapPin size={13} /> {charger.society_name} ({charger.society_city})
                </div>
              </div>
              <span className={`badge badge-${charger.status}`}>
                <span className={`status-dot ${charger.status}`} />
                {charger.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#070d19', padding: '10px', borderRadius: '8px', marginBottom: '14px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Power</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>{charger.power_output_kw} kW</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Connector</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>{charger.connector_type}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Public Rate</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#00A651' }}>₹{charger.price_per_kwh}/kWh</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: '0.78rem', color: '#94a3b8' }}>
                <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Open 24 Hours • Ground Bay {charger.parking_slot}
              </div>
              {charger.status === 'available' ? (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: '#00A651', borderColor: '#00A651' }}
                  onClick={() => {
                    setSelectedCharger(charger);
                    setShowStartModal(true);
                  }}
                >
                  <Play size={13} /> Plug & Charge 24/7
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" disabled style={{ opacity: 0.6 }}>
                  {charger.status === 'charging' ? 'In Use' : 'Offline'}
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                ⚡ Start 24/7 Public EV Charge
              </h3>
              <button className="modal-close" onClick={() => setShowStartModal(false)}>✕</button>
            </div>

            <form onSubmit={handleStartPublicCharge}>
              <div style={{ background: '#070d19', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #1e293b' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{selectedCharger.charger_number} — {selectedCharger.name}</div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{selectedCharger.society_name} • Rate: ₹{selectedCharger.price_per_kwh}/kWh</div>
              </div>

              <div className="form-group">
                <label className="form-label">Driver / Vehicle Owner Name</label>
                <input
                  className="form-input"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (For SMS Receipt)</label>
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
                <label className="form-label">EV Registration Plate</label>
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
