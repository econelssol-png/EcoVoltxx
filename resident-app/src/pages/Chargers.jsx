import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { Zap, MapPin, ArrowLeft } from 'lucide-react';

export default function Chargers() {
  const { society } = useAuth();
  const navigate = useNavigate();
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadChargers();
  }, [society?.id]);

  const loadChargers = async () => {
    try {
      const data = await api.getChargers(society.id);
      setChargers(data.chargers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? chargers : chargers.filter(c => c.status === filter);

  if (loading) {
    return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;
  }

  return (
    <div className="page">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">EV Chargers</h2>
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
          {chargers.filter(c => c.status === 'available').length} of {chargers.length} available
        </span>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {['all', 'available', 'charging', 'maintenance'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
            style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="charger-list">
        {filtered.map(charger => (
          <div key={charger.id} className="charger-card" onClick={() => navigate(`/chargers/${charger.id}`)}>
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

        {filtered.length === 0 && (
          <div className="empty-state">
            <Zap size={48} />
            <h3>No chargers found</h3>
            <p>No chargers match the selected filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
