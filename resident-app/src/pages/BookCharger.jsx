import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../services/api';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function BookCharger() {
  const { id } = useParams();
  const { society } = useAuth();
  const navigate = useNavigate();
  const [charger, setCharger] = useState(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    api.getCharger(society.id, id).then(d => setCharger(d.charger)).catch(console.error);
  }, [id]);

  const handleBook = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.createBooking(society.id, {
        charger_id: parseInt(id),
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
      });
      navigate('/bookings');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', padding: '0.5rem 0' }}>
        <ArrowLeft size={18} /> Back
      </button>

      <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
        <Calendar size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
        Book Charger {charger?.charger_number}
      </h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleBook}>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>

        {charger && date && startTime && endTime && (
          <div className="booking-summary">
            <h4 style={{ marginBottom: '0.75rem', fontSize: 'var(--font-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Booking Summary</h4>
            <div className="summary-row">
              <span className="label">Charger</span>
              <span>{charger.charger_number} — {charger.name}</span>
            </div>
            <div className="summary-row">
              <span className="label">Date</span>
              <span>{new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="summary-row">
              <span className="label">Time</span>
              <span>{startTime} — {endTime}</span>
            </div>
            <div className="summary-row">
              <span className="label">Rate</span>
              <span>₹{charger.price_per_kwh}/kWh</span>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Booking...' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  );
}
