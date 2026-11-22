import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import {
  CreditCard,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  IndianRupee,
  ShieldCheck,
  AlertTriangle,
  FileText
} from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import PaymentModal from '../components/PaymentModal';

export default function Payments() {
  const { society, user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [activePaymentTarget, setActivePaymentTarget] = useState(null);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const data = await api.getPaymentHistory();
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = (payment) => {
    setActivePaymentTarget({
      type: payment.invoice_id ? 'invoice' : (payment.session_id ? 'session' : 'booking'),
      id: payment.invoice_id || payment.session_id || payment.booking_id,
      amount: payment.amount,
      title: `Retry Payment for Transaction #${payment.transaction_reference}`,
      societyId: payment.society_id,
    });
  };

  if (loading) return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Payment History</h2>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            All EV charging transactions & receipt records
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {payments.map((p) => {
          const isSuccess = p.status === 'success';
          const isPending = p.status === 'pending';
          const isFailed = p.status === 'failed';
          const isRefunded = p.status === 'refunded';

          return (
            <div
              key={p.id}
              className="invoice-card"
              style={{
                background: '#131e18',
                border: '1px solid #1f3325',
                borderRadius: '12px',
                padding: '1.1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                      {p.transaction_reference || `TXN_${p.id}`}
                    </span>
                    {p.is_test ? (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#facc15',
                        fontWeight: 600,
                      }}>
                        DEMO / TEST
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(0, 166, 81, 0.15)',
                        color: '#00A651',
                        fontWeight: 600,
                      }}>
                        LIVE
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <span
                  className={`status-badge ${p.status}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textTransform: 'capitalize',
                  }}
                >
                  {isSuccess && <CheckCircle size={11} />}
                  {isFailed && <XCircle size={11} />}
                  {isPending && <Clock size={11} />}
                  {isRefunded && <RotateCcw size={11} />}
                  {p.status}
                </span>
              </div>

              {/* Related item info */}
              <div style={{
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '0.75rem',
                background: '#0d1510',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #1a2a1f',
              }}>
                {p.invoice_id && (
                  <span>Invoice for Month {p.invoice_month}/{p.invoice_year}</span>
                )}
                {p.session_id && (
                  <span>Charging Session #{p.session_id} {p.session_energy_kwh ? `(${parseFloat(p.session_energy_kwh).toFixed(2)} kWh)` : ''}</span>
                )}
                {p.booking_id && (
                  <span>Slot Booking #{p.booking_id} {p.booking_date ? `(${p.booking_date})` : ''}</span>
                )}
                {!p.invoice_id && !p.session_id && !p.booking_id && (
                  <span>EV Charging Account Transaction</span>
                )}
              </div>

              {/* Amount & Method */}
              <div className="invoice-details" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="history-detail">
                  <span className="label" style={{ fontSize: '0.75rem' }}>Method</span>
                  <span className="value" style={{ fontSize: '0.82rem' }}>{p.method || 'UPI / Gateway'}</span>
                </div>
                <div className="history-detail" style={{ textAlign: 'right' }}>
                  <span className="label" style={{ fontSize: '0.75rem' }}>Amount</span>
                  <span className="value" style={{ color: isRefunded ? '#ef4444' : 'var(--accent-primary)', fontSize: '1.05rem', fontWeight: 700 }}>
                    ₹{parseFloat(p.amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Refund Info if applicable */}
              {isRefunded && (
                <div style={{
                  marginTop: '0.6rem',
                  fontSize: '0.75rem',
                  color: '#f87171',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                }}>
                  Refund of ₹{parseFloat(p.refund_amount || p.amount).toFixed(2)} completed. (Ref: {p.refund_id || 'PROCESSED'})
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                {isSuccess && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedReceipt({
                      ...p,
                      user_name: user?.name,
                      society_name: society?.name,
                      flat_number: society?.flat_number,
                    })}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                  >
                    <FileText size={14} /> Download Receipt
                  </button>
                )}

                {isFailed && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRetryPayment(p)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                  >
                    <RotateCcw size={14} /> Retry Payment
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {payments.length === 0 && (
          <div className="empty-state">
            <CreditCard size={48} />
            <h3>No payments recorded</h3>
            <p>Your payment transactions and receipts will be cataloged here.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ReceiptModal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        data={selectedReceipt}
      />

      <PaymentModal
        isOpen={Boolean(activePaymentTarget)}
        onClose={() => setActivePaymentTarget(null)}
        paymentTarget={activePaymentTarget}
        onPaymentSuccess={() => {
          loadPayments();
        }}
      />
    </div>
  );
}
