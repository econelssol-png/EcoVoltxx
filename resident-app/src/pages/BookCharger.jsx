import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { ArrowLeft, Calendar, CreditCard, ShieldCheck } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';

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
  const [activePaymentTarget, setActivePaymentTarget] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    api.getCharger(society.id, id).then(d => setCharger(d.charger)).catch(console.error);
  }, [id]);

  const handleBookWithPayment = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.createBooking(society.id, {
        charger_id: parseInt(id),
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
      });

      // Open checkout payment modal for booking advance deposit (₹50)
      setActivePaymentTarget({
        type: 'booking',
        id: res.booking.id,
        amount: 50.0,
        title: `Slot Reservation Deposit — Charger ${charger?.charger_number} (${date})`,
        societyId: society.id,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookDirect = async (e) => {
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

      <form>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Start time</label>
            <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">End time</label>
            <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>

        {charger && date && startTime && endTime && (
          <div className="booking-summary" style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
              Booking & Checkout Summary
            </h4>
            <div className="summary-row">
              <span className="label">Charger</span>
              <span><span className="bay">{charger.charger_number}</span> {charger.name}</span>
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
            <div className="summary-row" style={{ borderTop: '1px dashed #233728', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span className="label">Slot booking deposit</span>
              <span style={{ fontWeight: 500, color: 'var(--accent-primary)' }}>₹50.00</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleBookWithPayment}
            disabled={loading || !date || !startTime || !endTime}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <CreditCard size={16} /> Pay Deposit (₹50) & Confirm Slot
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={handleBookDirect}
            disabled={loading || !date || !startTime || !endTime}
            style={{ fontSize: '0.85rem' }}
          >
            Confirm Without Pre-Payment
          </button>
        </div>
      </form>

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={Boolean(activePaymentTarget)}
        onClose={() => {
          setActivePaymentTarget(null);
          navigate('/bookings');
        }}
        paymentTarget={activePaymentTarget}
        onPaymentSuccess={() => {
          setActivePaymentTarget(null);
          navigate('/bookings');
        }}
      />
    </div>
  );
}
