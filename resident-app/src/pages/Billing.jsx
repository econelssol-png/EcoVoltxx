import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { Receipt, IndianRupee, Zap, Calendar, CreditCard, FileText } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';

export default function Billing() {
  const { society, user } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePaymentTarget, setActivePaymentTarget] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    loadBilling();
  }, [society?.id]);

  const loadBilling = async () => {
    try {
      const data = await api.getBilling(society.id);
      setBilling(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (loading) return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Billing</h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/payments')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
        >
          <CreditCard size={16} strokeWidth={1.5} /> Payments
        </button>
      </div>

      {/* Current Month Summary */}
      {billing?.currentMonth && (
        <div className="session-banner" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Unbilled, {monthNames[billing.currentMonth.month]} {billing.currentMonth.year}
          </h4>
          <div className="session-stats">
            <div className="session-stat">
              <div className="value">{billing.currentMonth.energy_kwh?.toFixed(1)}</div>
              <div className="label">kWh</div>
            </div>
            <div className="session-stat">
              <div className="value">₹{billing.currentMonth.amount?.toFixed(0)}</div>
              <div className="label">Amount</div>
            </div>
            <div className="session-stat">
              <div className="value">{billing.currentMonth.session_count}</div>
              <div className="label">Sessions</div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice History */}
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title" style={{ fontSize: 'var(--font-base)', margin: 0 }}>Monthly invoices</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {billing?.invoices?.map(inv => (
          <div key={inv.id} className="invoice-card">
            <div className="invoice-header">
              <div>
                <h4 style={{ fontSize: 'var(--font-base)', margin: 0 }}>
                  {monthNames[inv.month]} {inv.year}
                </h4>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {inv.session_count} sessions · Due: {inv.due_date || '15th'}
                </span>
              </div>
              <span className={`status-badge ${inv.status}`}>{inv.status}</span>
            </div>

            <div className="invoice-details">
              <div className="history-detail">
                <span className="label">Energy</span>
                <span className="value">{parseFloat(inv.total_energy_kwh).toFixed(2)} kWh</span>
              </div>
              <div className="history-detail">
                <span className="label">Amount</span>
                <span className="value" style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>₹{parseFloat(inv.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              {inv.status === 'pending' && (
                <button
                  className="btn btn-primary btn-sm btn-block"
                  onClick={() => setActivePaymentTarget({
                    type: 'invoice',
                    id: inv.id,
                    amount: inv.total_amount,
                    title: `Invoice #${inv.id} for ${monthNames[inv.month]} ${inv.year}`,
                    societyId: society.id,
                  })}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <CreditCard size={16} strokeWidth={1.5} /> Pay ₹{parseFloat(inv.total_amount).toFixed(2)}
                </button>
              )}

              {inv.status === 'paid' && (
                <button
                  className="btn btn-secondary btn-sm btn-block"
                  onClick={() => setSelectedReceipt({
                    ...inv,
                    user_name: user?.name,
                    society_name: society?.name,
                    flat_number: society?.flat_number,
                  })}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <FileText size={16} strokeWidth={1.5} /> View receipt
                </button>
              )}
            </div>
          </div>
        ))}

        {(!billing?.invoices || billing.invoices.length === 0) && (
          <div className="empty-state">
            <Receipt size={48} />
            <h3>No invoices yet</h3>
            <p>Invoices will appear here after your first billing cycle</p>
          </div>
        )}
      </div>

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={Boolean(activePaymentTarget)}
        onClose={() => setActivePaymentTarget(null)}
        paymentTarget={activePaymentTarget}
        onPaymentSuccess={() => {
          loadBilling();
        }}
      />

      {/* Downloadable / Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        data={selectedReceipt}
      />
    </div>
  );
}
