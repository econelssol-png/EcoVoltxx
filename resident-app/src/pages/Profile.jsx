import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../services/api';
import { User, Mail, Phone, Home, Car, LogOut, Building2 } from 'lucide-react';

export default function Profile() {
  const { user, society, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;

  const initials = profile?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="page">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">{initials}</div>
        <h2 style={{ fontSize: 'var(--font-lg)' }}>{profile?.user?.name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{profile?.user?.email}</p>
      </div>

      {/* Personal Info */}
      <div className="profile-section">
        <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Personal Info</h3>
        <div className="profile-row">
          <span className="label"><User size={14} style={{display:'inline',verticalAlign:'middle'}} /> Name</span>
          <span className="value">{profile?.user?.name}</span>
        </div>
        <div className="profile-row">
          <span className="label"><Mail size={14} style={{display:'inline',verticalAlign:'middle'}} /> Email</span>
          <span className="value">{profile?.user?.email}</span>
        </div>
        <div className="profile-row">
          <span className="label"><Phone size={14} style={{display:'inline',verticalAlign:'middle'}} /> Phone</span>
          <span className="value">{profile?.user?.phone || '—'}</span>
        </div>
      </div>

      {/* Society Info */}
      {profile?.memberships?.filter(m => m.status === 'approved').map(m => (
        <div key={m.society_id} className="profile-section">
          <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Society</h3>
          <div className="profile-row">
            <span className="label"><Building2 size={14} style={{display:'inline',verticalAlign:'middle'}} /> Society</span>
            <span className="value">{m.society_name}</span>
          </div>
          <div className="profile-row">
            <span className="label"><Home size={14} style={{display:'inline',verticalAlign:'middle'}} /> Flat</span>
            <span className="value">{m.flat_number || '—'}</span>
          </div>
          <div className="profile-row">
            <span className="label">Role</span>
            <span className={`status-badge ${m.member_role === 'admin' ? 'active' : 'approved'}`}>{m.member_role}</span>
          </div>
        </div>
      ))}

      {/* Vehicles */}
      {profile?.vehicles?.length > 0 && (
        <div className="profile-section">
          <h3 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Vehicles</h3>
          {profile.vehicles.map(v => (
            <div key={v.id} className="profile-row">
              <span className="label"><Car size={14} style={{display:'inline',verticalAlign:'middle'}} /> {v.make} {v.model}</span>
              <span className="value">{v.registration_number || v.color || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Logout */}
      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: '1rem' }}
        onClick={logout}
      >
        <LogOut size={18} /> Sign Out
      </button>

      {/* App Info Footer */}
      <div style={{ textAlign: 'center', marginTop: '2.5rem', paddingBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>⚡ EcoVoltX v1.0.0</div>
        <div style={{ marginTop: '4px' }}>
          Powered by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
        </div>
      </div>
    </div>
  );
}
