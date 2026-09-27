import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../services/api';
import { Zap, Battery, MapPin, Clock, IndianRupee, Bell, ChevronRight, AlertCircle } from 'lucide-react';

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

  const getTimeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <div className="page"><div className="loading-spinner"><div className="spinner" /><span className="loading-text">Loading dashboard...</span></div></div>;
  }

  const availableCount = chargers.filter(c => c.status === 'available').length;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div className="welcome-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>⚡ EcoVoltX</span>
            <span className="powered-by-tag" style={{ margin: 0, padding: '2px 8px', fontSize: '0.68rem' }}>
              by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
            </span>
          </div>
          <span className="greeting">{getTimeOfDay()}</span>
          <h2>{user?.name?.split(' ')[0]}</h2>
          <span className="society-name">{society?.name}</span>
        </div>
        <button className="btn btn-ghost btn-icon notification-badge" onClick={() => navigate('/notifications')}>
          <Bell size={22} />
          {notifCount > 0 && <span className="badge-count">{notifCount > 9 ? '9+' : notifCount}</span>}
        </button>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <div className="session-banner">
          <div className="session-header">
            <div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Session</span>
              <h3 style={{ fontSize: 'var(--font-md)', marginTop: '2px' }}>Charger {activeSession.charger_number}</h3>
            </div>
            <span className="status-badge charging">
              <span className="status-dot charging" />
              Charging
            </span>
          </div>
          <div className="session-stats">
            <div className="session-stat">
              <div className="value">{parseFloat(activeSession.energy_kwh || 0).toFixed(2)}</div>
              <div className="label">kWh</div>
            </div>
            <div className="session-stat">
              <div className="value">₹{parseFloat(activeSession.cost || 0).toFixed(0)}</div>
              <div className="label">Cost</div>
            </div>
            <div className="session-stat">
              <div className="value">{activeSession.duration_minutes || 0}</div>
              <div className="label">Min</div>
            </div>
          </div>
          <button className="btn btn-danger btn-block" style={{ marginTop: '1rem' }} onClick={handleStopCharging}>
            Stop Charging
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => navigate('/chargers')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon cyan"><Zap size={18} /></div>
          <div className="stat-value">{availableCount}/{chargers.length}</div>
          <div className="stat-label">Available Chargers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Battery size={18} /></div>
          <div className="stat-value">{billing?.currentMonth?.energy_kwh?.toFixed(1) || '0'}</div>
          <div className="stat-label">kWh This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><IndianRupee size={18} /></div>
          <div className="stat-value">₹{billing?.currentMonth?.amount?.toFixed(0) || '0'}</div>
          <div className="stat-label">This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Clock size={18} /></div>
          <div className="stat-value">{billing?.currentMonth?.session_count || 0}</div>
          <div className="stat-label">Sessions</div>
        </div>
      </div>

      {/* Available Chargers */}
      <div className="section-header">
        <h3 className="section-title">Chargers</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/chargers')}>
          View All <ChevronRight size={14} />
        </button>
      </div>

      <div className="charger-list">
        {chargers.slice(0, 3).map(charger => (
          <div
            key={charger.id}
            className="charger-card"
            onClick={() => navigate(`/chargers/${charger.id}`)}
          >
            <div className={`charger-icon ${charger.status}`}>
              <Zap size={22} />
            </div>
            <div className="charger-info">
              <h3>{charger.charger_number} — {charger.name}</h3>
              <span className="location">
                <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {charger.location_description}
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
