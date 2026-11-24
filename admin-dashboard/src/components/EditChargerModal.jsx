import React, { useState, useEffect } from 'react';
import { Zap, X, Save, ShieldCheck, AlertTriangle } from 'lucide-react';
import adminApi from '../services/api';

// Random 192-bit charger auth key (matches the server's generated key format)
function generateChargerAuthKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `ck_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export default function EditChargerModal({ isOpen, onClose, charger, societyId, showToast, onSuccess }) {
  const [formData, setFormData] = useState({
    charger_number: '',
    name: '',
    vendor: 'Schneider Electric',
    model: 'EVlink Pro AC',
    ocpp_version: '1.6J',
    connector_type: 'Type2',
    connector_count: 1,
    power_rating_kw: 7.4,
    price_per_kwh: 8.0,
    parking_location: '',
    integration_mode: 'DEMO',
    auth_key: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (charger) {
      setFormData({
        charger_number: charger.charger_number || '',
        name: charger.name || '',
        vendor: charger.vendor || charger.manufacturer || 'Schneider Electric',
        model: charger.model || 'EVlink Pro AC',
        ocpp_version: charger.ocpp_version || '1.6J',
        connector_type: charger.connector_type || 'Type2',
        connector_count: charger.connector_count || 1,
        power_rating_kw: charger.power_rating_kw || charger.power_output_kw || 7.4,
        price_per_kwh: charger.price_per_kwh || 8.0,
        parking_location: charger.parking_location || charger.parking_slot || charger.location_description || '',
        integration_mode: charger.integration_mode || 'DEMO',
        auth_key: charger.auth_key || '',
      });
    } else {
      setFormData({
        charger_number: '',
        name: '',
        vendor: 'Schneider Electric',
        model: 'EVlink Pro AC',
        ocpp_version: '1.6J',
        connector_type: 'Type2',
        connector_count: 1,
        power_rating_kw: 7.4,
        price_per_kwh: 8.0,
        parking_location: '',
        integration_mode: 'DEMO',
        auth_key: generateChargerAuthKey(),
      });
    }
  }, [charger, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (charger) {
        // Edit existing
        await adminApi.updateCharger(societyId, charger.id, {
          ...formData,
          power_rating_kw: parseFloat(formData.power_rating_kw),
          price_per_kwh: parseFloat(formData.price_per_kwh),
          connector_count: parseInt(formData.connector_count, 10),
        });
        showToast(`Charger ${formData.charger_number} updated successfully!`);
      } else {
        // Create new
        await adminApi.createCharger(societyId, {
          ...formData,
          power_rating_kw: parseFloat(formData.power_rating_kw),
          price_per_kwh: parseFloat(formData.price_per_kwh),
          connector_count: parseInt(formData.connector_count, 10),
        });
        showToast(`Charger ${formData.charger_number} created successfully!`);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to save charger', 'error');
    } finally {
      setLoading(false);
    }
  };

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
        maxWidth: '560px',
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
              background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 500 }}>
                {charger ? `Edit Charger ${charger.charger_number}` : 'Register New EV Charger'}
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Configure hardware identity, OCPP parameters, and integration mode
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Integration Mode Selector */}
          <div style={{
            background: formData.integration_mode === 'PRODUCTION' ? 'rgba(237, 237, 237, 0.06)' : 'rgba(234, 179, 8, 0.12)',
            border: `1px solid ${formData.integration_mode === 'PRODUCTION' ? 'var(--accent)' : 'rgba(234, 179, 8, 0.4)'}`,
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
          }}>
            <label className="form-label" style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Charger Integration Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, integration_mode: 'DEMO' })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: formData.integration_mode === 'DEMO' ? '2px solid #facc15' : '1px solid var(--border-color)',
                  background: formData.integration_mode === 'DEMO' ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-input)',
                  color: formData.integration_mode === 'DEMO' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                DEMO MODE (Simulated)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, integration_mode: 'PRODUCTION' })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: formData.integration_mode === 'PRODUCTION' ? '2px solid #00A651' : '1px solid var(--border-color)',
                  background: formData.integration_mode === 'PRODUCTION' ? 'rgba(237, 237, 237, 0.06)' : 'var(--bg-input)',
                  color: formData.integration_mode === 'PRODUCTION' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                PRODUCTION (Physical OCPP)
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', display: 'block' }}>
              {formData.integration_mode === 'PRODUCTION'
                ? 'Production mode requires compatible physical charger connected via OCPP 1.6-J WebSocket. Simulated charging is disabled.'
                : 'Demo mode uses simulated telemetry. Ideal for staging and resident app workflows without physical hardware.'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Charger Identifier (e.g. C-01)</label>
              <input
                className="form-input"
                value={formData.charger_number}
                onChange={e => setFormData({ ...formData, charger_number: e.target.value })}
                placeholder="C-01"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tower B Ground Fast Charger"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Hardware Vendor / OEM</label>
              <select
                className="form-select"
                value={formData.vendor}
                onChange={e => setFormData({ ...formData, vendor: e.target.value })}
              >
                <option value="Schneider Electric">Schneider Electric</option>
                <option value="ABB E-mobility">ABB E-mobility</option>
                <option value="Delta Electronics">Delta Electronics</option>
                <option value="Exicom Tele-Systems">Exicom Tele-Systems</option>
                <option value="Tata Power EZ Charge">Tata Power EZ Charge</option>
                <option value="EcoVoltX Smart">EcoVoltX OEM</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hardware Model</label>
              <input
                className="form-input"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
                placeholder="EVlink Pro AC / Terra 24"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">OCPP Version</label>
              <select
                className="form-select"
                value={formData.ocpp_version}
                onChange={e => setFormData({ ...formData, ocpp_version: e.target.value })}
              >
                <option value="1.6J">OCPP 1.6-J (JSON)</option>
                <option value="2.0.1">OCPP 2.0.1</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Connectors Count</label>
              <select
                className="form-select"
                value={formData.connector_count}
                onChange={e => setFormData({ ...formData, connector_count: parseInt(e.target.value, 10) })}
              >
                <option value="1">1 Connector</option>
                <option value="2">2 Connectors (Dual)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Connector Type</label>
              <select
                className="form-select"
                value={formData.connector_type}
                onChange={e => setFormData({ ...formData, connector_type: e.target.value })}
              >
                <option value="Type2">Type 2 (AC)</option>
                <option value="CCS2">CCS2 (DC Fast)</option>
                <option value="GB/T">GB/T</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Rated Power (kW)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={formData.power_rating_kw}
                onChange={e => setFormData({ ...formData, power_rating_kw: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tariff Rate (₹/kWh)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={formData.price_per_kwh}
                onChange={e => setFormData({ ...formData, price_per_kwh: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Parking Location / Bay</label>
              <input
                className="form-input"
                value={formData.parking_location}
                onChange={e => setFormData({ ...formData, parking_location: e.target.value })}
                placeholder="Ground Parking - Bay 12"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Charger Auth Key (OCPP Token)</label>
              <input
                className="form-input"
                value={formData.auth_key}
                onChange={e => setFormData({ ...formData, auth_key: e.target.value })}
                placeholder="e.g. key_ecovolt_c01"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Save size={16} /> {loading ? 'Saving...' : (charger ? 'Save Changes' : 'Register Charger')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
