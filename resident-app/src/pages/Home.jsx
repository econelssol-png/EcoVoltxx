import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { Zap, Bell, ChevronRight } from 'lucide-react';

export default function Home() {
  const { user, society } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [chargers, setChargers] = useState([]);
  const [billing, setBilling] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadActiveSession, 5000);
    return () => clearInterval(interval);
  }, [society?.id]);

  const loadDashboard = async () => {
    if (!society?.id) return;
    try {
      const [societyData, chargersData, sessionsData, billingData, notifsData] = await Promise.all([
        api.getSociety(society.id),
        api.getChargers(society.id),
        api.getSessions(society.id, 'status=active'),
        api.getBilling(society.id),
        api.getNotifications(),
      ]);

      setStats(societyData.stats);
      setChargers(chargersData.chargers || []);
      setBilling(billingData);
      setNotifCount(notifsData.unread_count || 0);

      const myActive = (sessionsData.sessions || []).find(s => s.user_id === user.id);
      setActiveSession(myActive || null);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveSession = async () => {
    if (!society?.id) return;
    try {
      const data = await api.getSessions(society.id, 'status=active');
      const myActive = (data.sessions || []).find(s => s.user_id === user.id);
      setActiveSession(myActive || null);
    } catch {}
  };

  const handleStopCharging = async () => {
    if (!activeSession) return;
    try {
      await api.stopSession(society.id, activeSession.id);
      setActiveSession(null);
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="page"><div className="loading-spinner"><div className="spinner" /><span className="loading-text">Loading</span></div></div>;
  }

  const availableCount = chargers.filter(c => c.status === 'available').length;
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const rupees = (n) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)}`;

  return (
    <div className="page">
      {/* Header: brand, then the context as the title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="brand-row">
          <Zap size={16} className="mark" fill="currentColor" strokeWidth={0} />
          EcoVoltX
          <span className="powered-by-tag">
            by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
          </span>
        </div>
        <button className="btn btn-ghost btn-icon notification-badge" onClick={() => navigate('/notifications')} aria-label="Notifications">
          <Bell size={20} strokeWidth={1.5} />
          {notifCount > 0 && <span className="badge-count">{notifCount > 9 ? '9+' : notifCount}</span>}
        </button>
      </div>

      <div className="welcome-banner" style={{ marginBottom: '24px' }}>
        <span className="greeting">{monthLabel}</span>
        <h2>{society?.name}</h2>
        <span className="society-name">{user?.name}</span>
      </div>

      {/* Active session: the meter */}
      {activeSession && (
        <div className="session-banner">
          <div className="session-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="bay">{activeSession.charger_number}</span>
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Charging session</span>
            </div>
            <span className="status-badge charging">
              <span className="status-dot charging" />
              Charging
            </span>
          </div>
          <div className="session-stats">
            <div className="session-stat">
              <div className="value">{parseFloat(activeSession.energy_kwh || 0).toFixed(3)}</div>
              <div className="label">kWh delivered</div>
            </div>
            <div className="session-stat">
              <div className="value">{rupees(activeSession.cost)}</div>
              <div className="label">Cost so far</div>
            </div>
            <div className="session-stat">
              <div className="value">{activeSession.duration_minutes || 0}</div>
              <div className="label">Minutes</div>
            </div>
          </div>
          <button className="btn btn-danger btn-block" style={{ marginTop: '16px' }} onClick={handleStopCharging}>
            Stop charging
          </button>
        </div>
      )}

      {/* This month, as numbers */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => navigate('/chargers')} style={{ cursor: 'pointer' }}>
          <div className="stat-value">{availableCount} of {chargers.length}</div>
          <div className="stat-label">Chargers free now</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(billing?.currentMonth?.energy_kwh || 0).toFixed(1)}</div>
          <div className="stat-label">kWh this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rupees(billing?.currentMonth?.amount)}</div>
          <div className="stat-label">Unbilled this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{billing?.currentMonth?.session_count || 0}</div>
          <div className="stat-label">Sessions this month</div>
        </div>
      </div>

      {/* Chargers */}
      <div className="section-header">
        <h3 className="section-title">Chargers</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/chargers')}>
          View all <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="charger-list">
        {chargers.slice(0, 3).map(charger => (
          <div
            key={charger.id}
            className="charger-card"
            onClick={() => navigate(`/chargers/${charger.id}`)}
          >
            <div className="charger-info">
              <h3><span className="bay">{charger.charger_number}</span>{charger.name}</h3>
              <span className="location">
                {charger.location_description}
              </span>
              <div className="charger-meta">
                <span className="meta-tag">{charger.power_rating_kw} kW</span>
                <span className="meta-tag">{charger.connector_type}</span>
                <span className="meta-tag">₹{charger.price_per_kwh}/kWh</span>
              </div>
            </div>
            <span className={`status-badge ${charger.status}`}>
              <span className={`status-dot ${charger.status}`} />
              {charger.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
