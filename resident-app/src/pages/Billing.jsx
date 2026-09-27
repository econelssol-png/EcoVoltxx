import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import api from '../services/api';
import { Receipt, IndianRupee, Zap, Calendar } from 'lucide-react';

export default function Billing() {
  const { society } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Billing</h2>

      {/* Current Month Summary */}
      {billing?.currentMonth && (
        <div className="session-banner" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
            Current Month — {monthNames[billing.currentMonth.month]} {billing.currentMonth.year}
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
      <div className="section-header">
        <h3 className="section-title" style={{ fontSize: 'var(--font-base)' }}>Invoice History</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {billing?.invoices?.map(inv => (
          <div key={inv.id} className="invoice-card">
            <div className="invoice-header">
              <div>
                <h4 style={{ fontSize: 'var(--font-base)' }}>
                  {monthNames[inv.month]} {inv.year}
                </h4>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {inv.session_count} sessions
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
                <span className="value" style={{ color: 'var(--accent-primary)' }}>₹{parseFloat(inv.total_amount).toFixed(2)}</span>
              </div>
            </div>
            {inv.status === 'pending' && (
              <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: '0.75rem' }}>
                Pay ₹{parseFloat(inv.total_amount).toFixed(0)}
              </button>
            )}
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
    </div>
  );
}
