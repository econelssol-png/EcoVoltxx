import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import adminApi from '../services/api';

const FIELDS = ['name', 'code', 'address', 'city', 'state', 'pincode', 'default_price_per_kwh'];

/**
 * Super admin: edit a society's name, join code, address and default rate.
 */
export default function EditSocietyModal({ society, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!society) return;
    const initial = {};
    for (const f of FIELDS) initial[f] = society[f] ?? '';
    setForm(initial);
    setError('');
  }, [society]);

  if (!society) return null;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const codeChanged = String(form.code || '').trim().toUpperCase() !== String(society.code || '').toUpperCase();
  const hasResidents = Number(society.stats?.members || 0) > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await adminApi.updateSociety(society.id, {
        name: form.name,
        code: form.code,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        default_price_per_kwh: form.default_price_per_kwh,
      });
      showToast(`${res.society?.name || 'Society'} updated`);
      onSaved?.(res.society);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the society');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="edit-society-title">
        <div className="modal-header">
          <h3 id="edit-society-title" style={{ fontSize: '16px', fontWeight: 500 }}>Edit {society.name}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {error && (
          <div role="alert" style={{ background: 'rgba(229, 72, 77, 0.12)', border: '1px solid rgba(229, 72, 77, 0.32)', color: '#f2a3a5', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="es-name">Society name</label>
            <input id="es-name" className="form-input" value={form.name || ''} onChange={set('name')} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="es-code">Join code</label>
            <input
              id="es-code"
              className="form-input mono"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              pattern="[A-Za-z0-9\-]{3,20}"
              title="3-20 letters, numbers or dashes"
              required
            />
            <div style={{ fontSize: '12px', color: codeChanged && hasResidents ? 'var(--accent-amber)' : 'var(--text-muted)', marginTop: '6px' }}>
              {codeChanged && hasResidents
                ? 'Residents who already joined stay joined. New residents must use the new code'
                : 'Residents type this code to join the society'}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="es-address">Address</label>
            <input id="es-address" className="form-input" value={form.address || ''} onChange={set('address')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="es-city">City</label>
              <input id="es-city" className="form-input" value={form.city || ''} onChange={set('city')} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="es-state">State</label>
              <input id="es-state" className="form-input" value={form.state || ''} onChange={set('state')} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="es-pincode">PIN code</label>
              <input id="es-pincode" className="form-input mono" inputMode="numeric" value={form.pincode || ''} onChange={set('pincode')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="es-rate">Default rate (₹ per kWh)</label>
            <input id="es-rate" className="form-input mono" type="number" step="0.5" min="0.5" value={form.default_price_per_kwh} onChange={set('default_price_per_kwh')} required />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Used for new chargers. Existing chargers keep their own rate
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
