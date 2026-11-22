import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { Clock, Zap, IndianRupee, Timer, CreditCard, FileText, CheckCircle } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';

export default function Sessions() {
  const { society, user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePaymentTarget, setActivePaymentTarget] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

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
        {sessions.map(s => {
          const isCompleted = s.status === 'completed';
          const isPaid = Boolean(s.payment_id || s.payment_status === 'success');
          const cost = parseFloat(s.cost || 0);

          return (
            <div key={s.id} className="history-item">
              <div className="history-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <h4 style={{ fontSize: 'var(--font-base)', margin: 0 }}>Charger {s.charger_number}</h4>
                    {s.is_simulated ? (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#facc15',
                        fontWeight: 600,
                      }}>
                        DEMO SIMULATED
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'rgba(0, 166, 81, 0.15)',
                        color: '#00A651',
                        fontWeight: 600,
                      }}>
                        PHYSICAL OCPP
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    {new Date(s.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(s.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`status-badge ${s.status}`}>{s.status}</span>
                </div>
              </div>

              <div className="history-details">
                <div className="history-detail">
                  <span className="label"><Zap size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Energy</span>
                  <span className="value">{parseFloat(s.energy_kwh).toFixed(2)} kWh</span>
                </div>
                <div className="history-detail">
                  <span className="label"><Timer size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Duration</span>
                  <span className="value">{s.duration_minutes ? `${s.duration_minutes} min` : '—'}</span>
                </div>
                <div className="history-detail">
                  <span className="label"><IndianRupee size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> Bill</span>
                  <span className="value" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>₹{cost.toFixed(2)}</span>
                </div>
              </div>

              {/* Pay Now or View Receipt Action */}
              {isCompleted && cost > 0 && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #1f3325', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isPaid ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', color: '#00A651', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                        <CheckCircle size={13} /> Bill Paid ({s.payment_reference || 'VERIFIED'})
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedReceipt({
                          ...s,
                          amount: s.cost,
                          user_name: user?.name,
                          society_name: society?.name,
                          flat_number: society?.flat_number,
                          transaction_reference: s.payment_reference,
                        })}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        <FileText size={12} /> Receipt
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                        Payment due on completion
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setActivePaymentTarget({
                          type: 'session',
                          id: s.id,
                          amount: cost,
                          title: `Charging Session #${s.id} on Charger ${s.charger_number}`,
                          societyId: society.id,
                        })}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                      >
                        <CreditCard size={13} /> Pay Now ₹{cost.toFixed(0)}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="empty-state">
            <Clock size={48} />
            <h3>No charging sessions yet</h3>
            <p>Start charging to see your history here</p>
          </div>
        )}
      </div>

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={Boolean(activePaymentTarget)}
        onClose={() => setActivePaymentTarget(null)}
        paymentTarget={activePaymentTarget}
        onPaymentSuccess={() => {
          loadSessions();
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        data={selectedReceipt}
      />
    </div>
  );
}
