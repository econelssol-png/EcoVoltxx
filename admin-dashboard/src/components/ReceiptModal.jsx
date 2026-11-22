import React from 'react';
import { Printer, Download, X, CheckCircle, ShieldCheck, Zap } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const isTest = data.is_test || data.payment?.is_test;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="receipt-container" onClick={e => e.stopPropagation()} style={{
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        padding: '2rem',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <button
          onClick={onClose}
          className="no-print"
          style={{
            position: 'absolute',
            top: '1rem', right: '1rem',
            background: 'none', border: 'none',
            color: '#64748b', cursor: 'pointer', padding: '4px',
          }}
        >
          <X size={20} />
        </button>

        {isTest && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fde047',
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.75rem',
            color: '#854d0e',
            textAlign: 'center',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            ⚠️ Demo Mode Test Transaction — Simulated Receipt (Not a tax deduction voucher)
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                background: '#00A651', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}>
                <Zap size={16} />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>EcoVoltX</h2>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Powered by EcoNelssol
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              GSTIN: 29AABCE1234F1Z8
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '0.25rem 0.6rem', borderRadius: '9999px',
              background: '#dcfce7', color: '#15803d',
              fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem',
            }}>
              <CheckCircle size={12} /> PAID
            </span>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Date: {new Date(data.paid_at || data.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.72rem' }}>Billed To</div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{data.user_name || 'Resident Member'}</div>
            <div style={{ color: '#64748b' }}>Flat: {data.flat_number || 'A-101'}</div>
            <div style={{ color: '#64748b' }}>{data.society_name || 'Green Valley Residency'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.72rem' }}>Transaction Details</div>
            <div>Ref: <strong style={{ color: '#0f172a' }}>{data.transaction_reference || `TXN_${data.id || '2026'}`}</strong></div>
            <div style={{ color: '#64748b' }}>Order: {data.order_reference || data.gateway_order_id || 'ORD_ECOVOLTX'}</div>
            <div style={{ color: '#64748b' }}>Method: {data.method || 'UPI / Netbanking'}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Description</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Units</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Rate</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.75rem', color: '#0f172a' }}>
                <strong>EV Smart Charging Consumption</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {data.invoice_id ? `Invoice #${data.invoice_id}` : 'Verified Charging Session'}
                </div>
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center', color: '#0f172a' }}>
                {parseFloat(data.total_energy_kwh || data.energy_kwh || 18.5).toFixed(2)} kWh
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#0f172a' }}>
                ₹8.00/kWh
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                ₹{parseFloat(data.total_amount || data.amount || 148).toFixed(2)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#64748b' }}>Subtotal:</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>
                ₹{parseFloat(data.total_amount || data.amount || 148).toFixed(2)}
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #0f172a' }}>
              <td colSpan="3" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Total Paid:</td>
              <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1.15rem', color: '#00A651' }}>
                ₹{parseFloat(data.total_amount || data.amount || 148).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          This is an official transaction voucher for society accounting. Signed and authenticated by EcoVoltX Platform Gateway.
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            style={{ flex: 1, color: '#475569', borderColor: '#cbd5e1' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#00A651', color: '#fff' }}
          >
            <Printer size={16} /> Print / Download Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
