import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  RotateCcw,
  Unlock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Radio,
  Cpu,
  RefreshCw,
  X
} from 'lucide-react';
import adminApi from '../services/api';

export default function ChargerDiagnosticsModal({ isOpen, onClose, charger, societyId, showToast, onRefresh }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executingCommand, setExecutingCommand] = useState(false);

  useEffect(() => {
    if (isOpen && charger) {
      loadDiagnostics();
    }
  }, [isOpen, charger]);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getChargerDiagnostics(societyId, charger.id);
      setDiagnostics(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load charger diagnostics', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !charger) return null;

  const handleSendCommand = async (command, params = {}) => {
    setExecutingCommand(true);
    try {
      const res = await adminApi.sendChargerCommand(societyId, charger.id, {
        command,
        ...params,
      });
      showToast(`Command ${command} confirmed by charger!`);
      loadDiagnostics();
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || `Command ${command} failed`, 'error');
    } finally {
      setExecutingCommand(false);
    }
  };

  const isOnline = diagnostics?.is_connected || charger.connectivity_status === 'online';

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: '#141e33',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        color: 'var(--text-primary)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'rgba(237, 237, 237, 0.06)', color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 500 }}>
                {charger.charger_number} — Hardware Diagnostics
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Vendor: {charger.vendor || 'EcoVoltX'} · Model: {charger.model || 'Smart-AC'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Live Connectivity Banner */}
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: isOnline ? 'rgba(237, 237, 237, 0.06)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isOnline ? 'rgba(0, 166, 81, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={18} color={isOnline ? 'var(--accent)' : 'var(--accent-rose)'} />
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.88rem', color: isOnline ? 'var(--accent)' : 'var(--accent-rose)' }}>
                OCPP Central System Status: {isOnline ? 'ONLINE & CONNECTED' : 'OFFLINE / DISCONNECTED'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Mode: <strong>{charger.integration_mode || 'DEMO'}</strong> · OCPP: {charger.ocpp_version || '1.6J'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Last Ping: {charger.last_heartbeat ? new Date(charger.last_heartbeat).toLocaleTimeString() : 'Never'}
          </span>
        </div>

        {/* Connector Breakdown Cards */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '10px' }}>
            Connector Status & Availability
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {(diagnostics?.connectors || [1]).map((conn, idx) => {
              const connId = conn.connector_id || idx + 1;
              const connType = conn.connector_type || charger.connector_type || 'Type2';
              const connStatus = conn.status || charger.status || 'Available';
              const meterKwh = (parseFloat(conn.meter_reading_wh || charger.meter_reading_wh || 0) / 1000).toFixed(2);

              return (
                <div key={connId} style={{
                  background: 'var(--bg-input)',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Connector #{connId} ({connType})
                    </span>
                    <span className={`badge badge-${connStatus.toLowerCase()}`}>
                      {connStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Meter Reading: <strong style={{ color: 'var(--accent)' }}>{meterKwh} kWh</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={executingCommand}
                    onClick={() => handleSendCommand('UnlockConnector', { connectorId: connId })}
                    style={{ width: '100%', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Unlock size={12} /> Unlock Connector #{connId}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Remote Central System Commands (Rule 13: Confirmed before marking success) */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '10px' }}>
            Remote Hardware Operations
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={executingCommand}
              onClick={() => handleSendCommand('Reset', { type: 'Soft' })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} /> Remote Soft Reset
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={executingCommand}
              onClick={() => handleSendCommand('Reset', { type: 'Hard' })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--accent-amber)', borderColor: 'rgba(237, 237, 237, 0.06)' }}
            >
              <RefreshCw size={14} /> Remote Hard Reboot
            </button>
          </div>
        </div>

        {/* Recent Command Audit Trail */}
        <div>
          <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '10px' }}>
            Hardware Command Audit History
          </h4>
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            maxHeight: '180px',
            overflowY: 'auto',
            fontSize: '0.78rem',
          }}>
            {diagnostics?.recent_commands?.length > 0 ? (
              diagnostics.recent_commands.map((cmd) => (
                <div key={cmd.id} style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cmd.command}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                      (Connector #{cmd.connector_id || 1})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 500,
                      color: cmd.status === 'accepted' ? 'var(--accent)' : (cmd.status === 'pending' ? 'var(--accent-amber)' : 'var(--accent-rose)'),
                      fontSize: '12px',
                    }}>
                      {cmd.status}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {new Date(cmd.sent_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No recent commands dispatched to this charger.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
