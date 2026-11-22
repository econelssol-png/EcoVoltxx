import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { Zap, MapPin, ArrowLeft, Calendar, Clock, IndianRupee, Play, Plug } from 'lucide-react';

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
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div className={`charger-icon ${charger.status}`} style={{ width: 72, height: 72, margin: '0 auto 1rem', borderRadius: 'var(--radius-lg)' }}>
          <Zap size={32} />
        </div>
        <h2 style={{ fontSize: 'var(--font-xl)', marginBottom: '4px' }}>{charger.charger_number}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>{charger.name}</p>
        <span className={`status-badge ${charger.status}`} style={{ marginTop: '0.5rem' }}>
          <span className={`status-dot ${charger.status}`} />
          {charger.status}
        </span>
      </div>

      {/* Details */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="profile-row">
          <span className="label"><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Location</span>
          <span className="value">{charger.location_description}</span>
        </div>
        <div className="profile-row">
          <span className="label"><Plug size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Connector</span>
          <span className="value">{charger.connector_type}</span>
        </div>
        <div className="profile-row">
          <span className="label"><Zap size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Power</span>
          <span className="value">{charger.power_rating_kw} kW</span>
        </div>
        <div className="profile-row">
          <span className="label"><IndianRupee size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Rate</span>
          <span className="value">₹{charger.price_per_kwh}/kWh</span>
        </div>
      </div>

      {/* Active Session Info */}
      {activeSession && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(34,211,238,0.3)' }}>
          <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem', fontSize: 'var(--font-sm)' }}>Currently Charging</h4>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
            Energy: {parseFloat(activeSession.energy_kwh).toFixed(2)} kWh • Cost: ₹{parseFloat(activeSession.cost).toFixed(2)}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
        {charger.status === 'available' && (
          <>
            <button className="btn btn-primary btn-block" onClick={handleStartCharging} disabled={starting}>
              <Play size={18} /> {starting ? 'Starting...' : 'Start Charging Now'}
            </button>
            <button className="btn btn-secondary btn-block" onClick={() => navigate(`/chargers/${charger.id}/book`)}>
              <Calendar size={18} /> Book for Later
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
