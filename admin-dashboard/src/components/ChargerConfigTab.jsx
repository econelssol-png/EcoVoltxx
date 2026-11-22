import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Save,
  CheckCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Zap,
  Radio
} from 'lucide-react';
import adminApi from '../services/api';

export default function ChargerConfigTab({ societyId, showToast }) {
  const [config, setConfig] = useState(null);
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedChargerForUrl, setSelectedChargerForUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [societyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfgRes, chgRes] = await Promise.all([
        adminApi.getIntegrationConfig(societyId).catch(() => ({ config: null })),
        adminApi.getChargers(societyId).catch(() => ({ chargers: [] })),
      ]);

      setConfig(cfgRes.config || {
        ocpp_server_ws_url: 'ws://localhost:3000/ocpp',
        heartbeat_interval_seconds: 60,
        connection_timeout_seconds: 30,
        default_mode: 'DEMO',
        auth_required: false,
      });

      const list = chgRes.chargers || [];
      setChargers(list);
      if (list.length > 0 && !selectedChargerForUrl) {
        setSelectedChargerForUrl(list[0].charger_number);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateIntegrationConfig(societyId, config);
      showToast('Charger integration configuration saved successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedChargerObj = chargers.find(c => c.charger_number === selectedChargerForUrl);
  const connectionUrl = `${config?.ocpp_server_ws_url || 'ws://localhost:3000/ocpp'}/${selectedChargerForUrl || 'C-01'}${selectedChargerObj?.auth_key ? `?token=${selectedChargerObj.auth_key}` : ''}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(connectionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('WebSocket URL copied to clipboard');
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading integration settings...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
            Physical Charger & OCPP 1.6-J Integration
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Configure Central System WebSocket server endpoints, hardware credentials, and integration modes
          </p>
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={loadData}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>

      {/* Integration Mode Overview Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Radio size={20} color="#00A651" /> Central System Connection Parameters
          </div>
          <span style={{
            fontSize: '0.78rem',
            padding: '4px 10px',
            borderRadius: '9999px',
            background: config?.default_mode === 'PRODUCTION' ? 'rgba(0, 166, 81, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            color: config?.default_mode === 'PRODUCTION' ? '#00A651' : '#facc15',
            fontWeight: 700,
          }}>
            Default Mode: {config?.default_mode || 'DEMO'}
          </span>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Server Endpoint URL */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ fontWeight: 600, color: '#f8fafc' }}>
                Central System WebSocket URL (OCPP 1.6-J Endpoint)
              </label>
              <input
                type="text"
                className="form-input"
                value={config?.ocpp_server_ws_url || ''}
                onChange={e => setConfig({ ...config, ocpp_server_ws_url: e.target.value })}
                placeholder="ws://localhost:3000/ocpp or wss://chargenest.yourdomain.com/ocpp"
                required
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Physical OCPP-compliant charging stations must be pointed to this WebSocket URL in their management portal.
              </span>
            </div>

            {/* Default Integration Mode */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#f8fafc' }}>
                Society Integration Mode
              </label>
              <select
                className="form-select"
                value={config?.default_mode || 'DEMO'}
                onChange={e => setConfig({ ...config, default_mode: e.target.value })}
              >
                <option value="DEMO">DEMO MODE — Software Simulator Enabled</option>
                <option value="PRODUCTION">PRODUCTION MODE — Physical Hardware Required</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Production mode strictly verifies connected physical chargers before remote start/stop.
              </span>
            </div>

            {/* Heartbeat Interval */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#f8fafc' }}>
                Heartbeat Interval (Seconds)
              </label>
              <input
                type="number"
                className="form-input"
                min="10"
                max="600"
                value={config?.heartbeat_interval_seconds || 60}
                onChange={e => setConfig({ ...config, heartbeat_interval_seconds: parseInt(e.target.value, 10) })}
                required
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Frequency of keep-alive pings sent by physical charging stations.
              </span>
            </div>

            {/* Command Timeout */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#f8fafc' }}>
                Command Timeout (Seconds)
              </label>
              <input
                type="number"
                className="form-input"
                min="5"
                max="60"
                value={config?.connection_timeout_seconds || 30}
                onChange={e => setConfig({ ...config, connection_timeout_seconds: parseInt(e.target.value, 10) })}
                required
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Time before RemoteStart / RemoteStop / Reset aborts if charger doesn't respond.
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={16} /> {saving ? 'Saving Settings...' : 'Save Integration Settings'}
          </button>
        </form>
      </div>

      {/* Auto-Generated Connection String Generator */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Terminal size={20} color="#38bdf8" /> Physical Charger Connection URL Generator
          </div>
        </div>

        <div style={{ background: '#0b1120', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Select Charger:</label>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '220px' }}
              value={selectedChargerForUrl}
              onChange={e => setSelectedChargerForUrl(e.target.value)}
            >
              {chargers.map(c => (
                <option key={c.id} value={c.charger_number}>
                  {c.charger_number} — {c.name} ({c.vendor || 'EcoVoltX'})
                </option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#070b14',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #1e293b',
            fontFamily: 'monospace',
            fontSize: '0.88rem',
            color: '#38bdf8',
            wordBreak: 'break-all',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <span>{connectionUrl}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={copyToClipboard}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? <CheckCircle size={14} color="#00A651" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
          </div>

          <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
            Enter this URL in your physical EV charger's configuration portal (e.g. Schneider EVlink web portal, ABB Terra portal, Delta AC MAX settings). Subprotocol supported: <strong>OCPP 1.6-J</strong>.
          </div>
        </div>
      </div>

      {/* Hardware Checklist & Requirements Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={20} color="#00A651" /> Compatible Hardware & Setup Guide
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#0b1120', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: '0.92rem', color: '#f8fafc', marginBottom: '8px', fontWeight: 700 }}>
              1. Network Connectivity
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              Ensure charging stations have static IP or DHCP on society LAN with outbound WebSocket access on port 3000 (or port 443 with SSL).
            </p>
          </div>

          <div style={{ background: '#0b1120', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: '0.92rem', color: '#f8fafc', marginBottom: '8px', fontWeight: 700 }}>
              2. OCPP 1.6-J JSON Protocol
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              Set charger protocol to <strong>OCPP-J 1.6</strong>. Supported actions: BootNotification, Heartbeat, StatusNotification, MeterValues, Start/StopTransaction.
            </p>
          </div>

          <div style={{ background: '#0b1120', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: '0.92rem', color: '#f8fafc', marginBottom: '8px', fontWeight: 700 }}>
              3. Production Mode Enforcement
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              In Production mode, simulated telemetry is completely disabled. Only real meter readings from physical hardware are used for tenant billing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
