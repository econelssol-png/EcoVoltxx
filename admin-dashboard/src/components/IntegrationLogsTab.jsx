import React, { useState, useEffect } from 'react';
import {
  Terminal,
  RefreshCw,
  Download,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle,
  Filter,
  Search
} from 'lucide-react';
import adminApi from '../services/api';

export default function IntegrationLogsTab({ societyId, showToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [societyId, levelFilter, typeFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (levelFilter !== 'ALL') params.level = levelFilter.toLowerCase();
      if (typeFilter !== 'ALL') params.type = typeFilter;

      const data = await adminApi.getIntegrationLogs(societyId, params);
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load integration logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Level', 'Source', 'Type', 'Message', 'Details'];
    const rows = logs.map(l => [
      new Date(l.created_at).toISOString(),
      l.level.toUpperCase(),
      l.source,
      l.type,
      `"${l.message.replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `integration_logs_society_${societyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Integration Health & Hardware Error Logs
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Real-time audit log of OCPP 1.6-J messages, charger connectivity drops, and payment gateway webhooks
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline btn-sm" onClick={loadLogs} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh Logs
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportLogs} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Export Logs CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#0f172a',
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Severity Level:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Event Category:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="ocpp_event">OCPP Hardware Events</option>
            <option value="ocpp_error">OCPP Hardware Errors</option>
            <option value="payment_webhook">Payment Webhooks</option>
            <option value="payment_error">Payment Verification Errors</option>
            <option value="payment_verified">Verified Payments</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Source</th>
                <th>Message</th>
                <th>Charger</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const isError = log.level === 'error';
                const isWarn = log.level === 'warn';

                return (
                  <tr key={log.id} style={{ background: isError ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </td>

                    <td>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isError ? 'rgba(239, 68, 68, 0.15)' : (isWarn ? 'rgba(237, 237, 237, 0.06)' : 'rgba(16, 185, 129, 0.15)'),
                        color: isError ? 'var(--accent-rose)' : (isWarn ? 'var(--accent-amber)' : '#10b981'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {isError && <XCircle size={10} />}
                        {isWarn && <AlertTriangle size={10} />}
                        {!isError && !isWarn && <Info size={10} />}
                        {log.level.toUpperCase()}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        {log.source}
                      </span>
                    </td>

                    <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '380px' }}>
                      {log.message}
                    </td>

                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {log.charger_id ? `Charger #${log.charger_id}` : 'Platform'}
                      </span>
                    </td>

                    <td>
                      {log.details ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setSelectedLog(log)}
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        >
                          View JSON
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No integration logs found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Event Payload Inspector
              </h3>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>✕</button>
            </div>
            <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Message:</strong> {selectedLog.message}
            </div>
            <pre style={{
              background: '#070b14',
              color: 'var(--text-primary)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              overflowX: 'auto',
              maxHeight: '340px',
            }}>
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                } catch {
                  return selectedLog.details;
                }
              })()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
