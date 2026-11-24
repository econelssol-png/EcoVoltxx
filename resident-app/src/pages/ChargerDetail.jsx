import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { ArrowLeft, Calendar, Play } from 'lucide-react';

export default function ChargerDetail() {
  const { id } = useParams();
  const { society, user } = useAuth();
  const navigate = useNavigate();
  const [charger, setCharger] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadCharger();
  }, [id, society?.id]);

  const loadCharger = async () => {
    try {
      const data = await api.getCharger(society.id, id);
      setCharger(data.charger);
      setActiveSession(data.activeSession);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCharging = async () => {
    setStarting(true);
    try {
      await api.startSession(society.id, charger.id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;
  }

  if (!charger) {
    return <div className="page"><div className="empty-state"><h3>Charger not found</h3></div></div>;
  }

  return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', padding: '0.5rem 0' }}>
        <ArrowLeft size={18} /> Back
      </button>

      {/* Charger Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span className="bay" style={{ height: '28px', padding: '0 8px', fontSize: 'var(--font-sm)' }}>{charger.charger_number}</span>
          <span className={`status-badge ${charger.status}`}>
            <span className={`status-dot ${charger.status}`} />
            {charger.status}
          </span>
        </div>
        <h2 style={{ fontSize: 'var(--font-2xl)', lineHeight: 1.15, fontWeight: 500 }}>{charger.name}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px' }}>{charger.location_description}</p>
      </div>

      {/* Details */}
      <div className="profile-section" style={{ marginBottom: '16px' }}>
        <div className="profile-row">
          <span className="label">Connector</span>
          <span className="value">{charger.connector_type}</span>
        </div>
        <div className="profile-row">
          <span className="label">Power</span>
          <span className="value mono">{charger.power_rating_kw} kW</span>
        </div>
        <div className="profile-row">
          <span className="label">Rate</span>
          <span className="value mono">₹{parseFloat(charger.price_per_kwh).toFixed(2)}/kWh</span>
        </div>
      </div>

      {/* Your active session here: the meter */}
      {activeSession && (
        <div className="session-banner" style={{ marginBottom: '16px' }}>
          <div className="session-stats">
            <div className="session-stat">
              <div className="value">{parseFloat(activeSession.energy_kwh || 0).toFixed(3)}</div>
              <div className="label">kWh delivered</div>
            </div>
            <div className="session-stat">
              <div className="value">₹{parseFloat(activeSession.cost || 0).toFixed(2)}</div>
              <div className="label">Cost so far</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
        {charger.status === 'available' && (
          <>
            <button className="btn btn-primary btn-block" onClick={handleStartCharging} disabled={starting}>
              <Play size={16} strokeWidth={1.5} /> {starting ? 'Starting' : 'Start charging'}
            </button>
            <button className="btn btn-secondary btn-block" onClick={() => navigate(`/chargers/${charger.id}/book`)}>
              <Calendar size={16} strokeWidth={1.5} /> Book a slot
            </button>
          </>
        )}

        {charger.status === 'charging' && !activeSession && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>This charger is currently in use by another resident.</p>
          </div>
        )}

        {charger.status === 'maintenance' && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--yellow)' }}>
            <p>This charger is under maintenance.</p>
          </div>
        )}
      </div>
    </div>
  );
}
