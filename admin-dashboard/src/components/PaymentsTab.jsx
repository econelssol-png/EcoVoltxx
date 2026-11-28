import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Download,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import adminApi from '../services/api';

export default function PaymentsTab({ societyId, showToast, onOpenRefund, onOpenReceipt }) {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'REAL' | 'TEST'
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState(null);

  useEffect(() => {
    loadPayments();
  }, [societyId]);

  useEffect(() => {
    adminApi.getPaymentConfig()
      .then((res) => setGatewayConfig(res.config))
      .catch(() => {});
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSocietyPayments(societyId);
      setPayments(data.payments || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to load society payments:', err);
      showToast('Failed to load payment transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (filterMode === 'REAL' && p.is_test) return false;
    if (filterMode === 'TEST' && !p.is_test) return false;
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTxn = p.transaction_reference?.toLowerCase().includes(q);
      const matchName = p.user_name?.toLowerCase().includes(q);
      const matchFlat = p.flat_number?.toLowerCase().includes(q);
      const matchOrder = p.gateway_order_id?.toLowerCase().includes(q);
      if (!matchTxn && !matchName && !matchFlat && !matchOrder) return false;
    }

    return true;
  });

  const exportCSV = () => {
    if (filteredPayments.length === 0) return;
    const headers = ['Transaction Ref', 'Order ID', 'Resident', 'Flat', 'Amount', 'Currency', 'Method', 'Status', 'Mode', 'Date'];
    const rows = filteredPayments.map(p => [
      p.transaction_reference || p.id,
      p.gateway_order_id || p.order_reference || '',
      `"${p.user_name || ''}"`,
      p.flat_number || '',
      p.amount,
      p.currency || 'INR',
      p.method || 'UPI',
      p.status,
      p.is_test ? 'TEST/DEMO' : 'LIVE',
      new Date(p.created_at).toISOString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_transactions_society_${societyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Society Financial Transactions & Reconciliation
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Audit all resident payment collections, test mode transactions, and process refunds
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline btn-sm" onClick={loadPayments} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Export Financial CSV
          </button>
        </div>
      </div>

      {gatewayConfig?.available === false && (
        <div role="status" className="card" style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start', borderLeft: '4px solid var(--accent-amber)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Online payment is off
            </strong>
            <span style={{ color: 'var(--text-secondary)' }}>
              Residents can't pay in the app and their bills stay due.{' '}
              {gatewayConfig.setup_problem || 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Railway\'s variables to switch it on.'}
              {' '}Change it in Railway's variables, then deploy.
            </span>
          </div>
        </div>
      )}

      {/* Summary Metrics Grid (Rule 10: Clearly identify test transactions and prevent them from being reported as real collections) */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        {/* Real Collections */}
        <div className="metric-card" style={{ borderLeft: '4px solid #00A651' }}>
          <div className="metric-card-top">
            <span className="metric-title">Verified Real Collections</span>
            <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent)' }}>
            ₹{(summary?.total_real_collections || 0).toLocaleString()}
          </div>
          <div className="metric-subtitle">
            {summary?.real_transaction_count || 0} production live payments
          </div>
        </div>

        {/* Demo / Test Collections */}
        <div className="metric-card" style={{ borderLeft: '4px solid #facc15' }}>
          <div className="metric-card-top">
            <span className="metric-title">Demo / Test Collections</span>
            <div className="metric-icon-box" style={{ background: 'rgba(234, 179, 8, 0.15)', color: 'var(--accent-amber)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)' }}>
            ₹{(summary?.total_test_collections || 0).toLocaleString()}
          </div>
          <div className="metric-subtitle" style={{ color: 'var(--text-secondary)' }}>
            {summary?.test_transaction_count || 0} simulated transactions (Excluded from tax revenue)
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-title">Pending Receivables</span>
            <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: '#3b82f6' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="metric-value">
            ₹{(summary?.total_pending || 0).toLocaleString()}
          </div>
          <div className="metric-subtitle">
            {summary?.pending_count || 0} invoices awaiting resident payment
          </div>
        </div>

        {/* Total Refunded */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-title">Total Refunded</span>
            <div className="metric-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose)' }}>
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-rose)' }}>
            ₹{(summary?.total_refunded || 0).toLocaleString()}
          </div>
          <div className="metric-subtitle">
            {summary?.refund_count || 0} refunded transactions
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#0f172a',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '260px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search by Transaction Ref, Resident, or Flat #..."
              className="form-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mode:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={filterMode}
              onChange={e => setFilterMode(e.target.value)}
            >
              <option value="ALL">All Modes</option>
              <option value="REAL">Live / Production Only</option>
              <option value="TEST">Demo / Test Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction Ref</th>
                <th>Resident</th>
                <th>Item / Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => {
                const isSuccess = p.status === 'success';
                const isRefunded = p.status === 'refunded';

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        {p.transaction_reference || `TXN_${p.id}`}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {p.gateway_order_id || p.order_reference || '—'}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.user_name || `User #${p.user_id}`}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Flat: {p.flat_number || 'Resident'}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {p.invoice_id ? `Invoice #${p.invoice_id}` : (p.session_id ? `Session #${p.session_id}` : (p.booking_id ? `Booking Deposit #${p.booking_id}` : 'General'))}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: 500, fontSize: '0.95rem', color: isRefunded ? 'var(--accent-rose)' : 'var(--accent)' }}>
                        ₹{parseFloat(p.amount).toFixed(2)}
                      </span>
                    </td>

                    <td>
                      <span style={{ background: 'var(--bg-input)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        {p.method || 'UPI'}
                      </span>
                    </td>

                    <td>
                      {p.is_test ? (
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: 'var(--accent-amber)',
                          fontWeight: 500,
                        }}>
                          TEST / DEMO
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(237, 237, 237, 0.06)',
                          color: 'var(--accent)',
                          fontWeight: 500,
                        }}>
                          LIVE PRODUCTION
                        </span>
                      )}
                    </td>

                    <td>
                      <span className={`badge badge-${p.status}`}>
                        <span className={`status-dot ${p.status}`} />
                        {p.status}
                      </span>
                    </td>

                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' '}
                      {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {isSuccess && (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              title="View Tax Receipt"
                              onClick={() => onOpenReceipt(p)}
                              style={{ padding: '4px 8px' }}
                            >
                              <FileText size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              title="Process Refund"
                              onClick={() => onOpenRefund(p)}
                              style={{ padding: '4px 8px', color: 'var(--accent-rose)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                              <RotateCcw size={13} />
                            </button>
                          </>
                        )}
                        {isRefunded && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 600 }}>Refunded</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No payment transactions match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
