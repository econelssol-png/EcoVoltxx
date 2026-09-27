import { useState, useEffect } from 'react';
import api from '../services/api';
import { Bell, Check, CheckCheck } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnread(data.unread_count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch {}
  };

  const getIcon = (type) => {
    const colors = {
      charging_started: 'var(--accent-primary)',
      charging_completed: 'var(--green)',
      booking_confirmed: 'var(--blue)',
      payment_success: 'var(--green)',
      welcome: 'var(--accent-secondary)',
    };
    return colors[type] || 'var(--text-muted)';
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) return <div className="page"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">Notifications</h2>
        {unread > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>
            <CheckCheck size={16} /> Read All
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notification-item ${!n.read ? 'unread' : ''}`}
            onClick={() => !n.read && handleMarkRead(n.id)}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: getIcon(n.type), marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: n.read ? 400 : 600, marginBottom: 2 }}>{n.title}</h4>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</p>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>{timeAgo(n.created_at)}</span>
            </div>
            {!n.read && <Check size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="empty-state">
            <Bell size={48} />
            <h3>No notifications</h3>
            <p>You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}
