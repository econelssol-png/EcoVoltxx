import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { Calendar, X, Clock } from 'lucide-react';

export default function Bookings() {
  const { society } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadBookings();
  }, [society?.id, filter]);

  const loadBookings = async () => {
    try {
      const params = filter ? `status=${filter}` : '';
      const data = await api.getBookings(society.id, params);
      setBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await api.cancelBooking(society.id, id);
      loadBookings();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <h2 className="section-title" style={{ marginBottom: '1rem' }}>Bookings</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {['', 'upcoming', 'active', 'completed', 'cancelled'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
            {f || 'All'}
          </button>
        ))}
      </div>

      <div className="history-list">
        {bookings.map(b => (
          <div key={b.id} className="history-item">
            <div className="history-header">
              <div>
                <h4 style={{ fontSize: 'var(--font-base)' }}>Charger {b.charger_number}</h4>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {new Date(b.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <span className={`status-badge ${b.status}`}>{b.status}</span>
            </div>
            <div className="history-details">
              <div className="history-detail">
                <span className="label">Time</span>
                <span className="value">{b.start_time} — {b.end_time}</span>
              </div>
              <div className="history-detail">
                <span className="label">Location</span>
                <span className="value">{b.charger_location || '—'}</span>
              </div>
              {b.status === 'upcoming' && (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)}>
                    <X size={14} /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {bookings.length === 0 && (
          <div className="empty-state">
            <Calendar size={48} />
            <h3>No bookings yet</h3>
            <p>Book a charger from the chargers page</p>
          </div>
        )}
      </div>
    </div>
  );
}
