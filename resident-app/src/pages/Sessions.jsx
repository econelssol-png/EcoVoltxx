import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import api from '../services/api';
import { Clock, Zap, IndianRupee, Timer } from 'lucide-react';

export default function Sessions() {
  const { society } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [society?.id]);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions(society.id);
      setSessions(data.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>Charging History</h2>

      <div className="history-list">
        {sessions.map(s => (
          <div key={s.id} className="history-item">
            <div className="history-header">
              <div>
                <h4 style={{ fontSize: 'var(--font-base)' }}>Charger {s.charger_number}</h4>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {new Date(s.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {new Date(s.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className={`status-badge ${s.status}`}>{s.status}</span>
            </div>
            <div className="history-details">
              <div className="history-detail">
                <span className="label"><Zap size={11} style={{display:'inline',verticalAlign:'middle'}} /> Energy</span>
                <span className="value">{parseFloat(s.energy_kwh).toFixed(2)} kWh</span>
              </div>
              <div className="history-detail">
                <span className="label"><Timer size={11} style={{display:'inline',verticalAlign:'middle'}} /> Duration</span>
                <span className="value">{s.duration_minutes ? `${s.duration_minutes} min` : '—'}</span>
              </div>
              <div className="history-detail">
                <span className="label"><IndianRupee size={11} style={{display:'inline',verticalAlign:'middle'}} /> Cost</span>
                <span className="value" style={{ color: 'var(--accent-primary)' }}>₹{parseFloat(s.cost).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="empty-state">
            <Clock size={48} />
            <h3>No charging sessions yet</h3>
            <p>Start charging to see your history here</p>
          </div>
        )}
      </div>
    </div>
  );
}
