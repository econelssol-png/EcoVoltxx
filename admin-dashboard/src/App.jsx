import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import adminApi from './services/api';
import './index.css';
import {
  LayoutDashboard,
  Zap,
  Users,
  Calendar,
  History,
  DollarSign,
  BarChart3,
  BellRing,
  Building,
  Shield,
  LogOut,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  BatteryCharging,
  Settings,
  Download,
  Send,
  UserCheck,
  CreditCard,
  Check,
  Sparkles,
  ExternalLink,
  Radio,
  Activity,
  FileText,
  Terminal,
  Cpu
} from 'lucide-react';

import ChargerConfigTab from './components/ChargerConfigTab';
import PaymentsTab from './components/PaymentsTab';
import IntegrationLogsTab from './components/IntegrationLogsTab';
import ChargerDiagnosticsModal from './components/ChargerDiagnosticsModal';
import RefundModal from './components/RefundModal';
import LoginScreen from './components/LoginScreen';
import EditChargerModal from './components/EditChargerModal';
import ReceiptModal from './components/ReceiptModal';

const TAB_TITLES = {
  dashboard: 'Dashboard', chargers: 'Chargers', 'ocpp-config': 'Hardware (OCPP)', residents: 'Residents',
  bookings: 'Bookings', sessions: 'Sessions', payments: 'Payments', subscription: 'Plan', tariffs: 'Tariffs',
  reports: 'Reports', logs: 'Integration logs', announcements: 'Announcements',
  'platform-subscriptions': 'Subscriptions', societies: 'Societies',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [societiesList, setSocietiesList] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [chargers, setChargers] = useState([]);
  const [residents, setResidents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [superAdminData, setSuperAdminData] = useState(null);

  // Subscription states
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [platformSubscriptions, setPlatformSubscriptions] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState(null);

  // Modals & form states
  const [showAddChargerModal, setShowAddChargerModal] = useState(false);
  const [showEditChargerModal, setShowEditChargerModal] = useState(false);
  const [selectedChargerForEdit, setSelectedChargerForEdit] = useState(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [selectedChargerForDiag, setSelectedChargerForDiag] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [showAddSocietyModal, setShowAddSocietyModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showAssignAdminModal, setShowAssignAdminModal] = useState(false);
  const [selectedSocietyForAdmin, setSelectedSocietyForAdmin] = useState(null);

  // Notification / Alert message
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Demo mode (from the server) enables the demo quick sign-in and role switcher
  const [demoMode, setDemoMode] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Demo accounts (only offered when the server runs with DEMO_MODE on)
  const DEMO_PASSWORD = 'password123';
  const demoAccounts = [
    { label: 'Super Admin (MRR & Platform)', email: 'superadmin@societycharge.com', password: DEMO_PASSWORD },
    { label: 'Green Valley Admin (Pro Plan)', email: 'admin_gvr@test.com', password: DEMO_PASSWORD },
    { label: 'Sunrise Towers Admin (Starter Plan)', email: 'admin_srt@test.com', password: DEMO_PASSWORD },
  ];

  const residentAppUrl = import.meta.env.DEV ? 'http://localhost:5173/app/' : '/app/';

  // Apply a signed-in user: only super admins and society admins may use the portal
  const applySession = async (user, memberships = []) => {
    const adminMemberships = memberships.filter(m => m.member_role === 'admin');
    if (user.role !== 'super_admin' && adminMemberships.length === 0) {
      adminApi.clearTokens();
      throw new Error('This account has no admin access. Residents should use the resident app.');
    }

    setCurrentTab('dashboard');
    if (user.role === 'super_admin') {
      const sRes = await adminApi.getAllSocieties();
      const list = sRes.societies || [];
      setSocietiesList(list);
      setSelectedSocietyId(list[0]?.id || null);
    } else {
      setSocietiesList(adminMemberships.length > 1
        ? adminMemberships.map(m => ({ id: m.society_id, name: m.society_name, code: m.society_code }))
        : []);
      setSelectedSocietyId(adminMemberships[0].society_id);
    }
    setCurrentUser(user);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogin = async (email, password) => {
    const data = await adminApi.login(email, password);
    adminApi.setTokens(data.accessToken, data.refreshToken);
    await applySession(data.user, data.memberships);
    showToast(`Signed in as ${data.user.name}`);
  };

  // Demo role switcher (DEMO_MODE only)
  const handleQuickLogin = async (email) => {
    setLoading(true);
    try {
      await handleLogin(email, DEMO_PASSWORD);
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminApi.clearTokens();
    setCurrentUser(null);
    setSelectedSocietyId(null);
    setSocietiesList([]);
    setDashboardData(null);
    setChargers([]);
    setSessions([]);
    setSuperAdminData(null);
    setSubscriptionData(null);
    setCurrentTab('dashboard');
  };

  // Initial boot: read demo mode, then restore a saved session (no automatic login)
  useEffect(() => {
    adminApi.onSessionExpired = () => {
      handleLogout();
      showToast('Session expired. Please sign in again.', 'error');
    };

    (async () => {
      try {
        const info = await adminApi.getServerInfo();
        setDemoMode(Boolean(info.demo_mode));
      } catch {
        setDemoMode(false);
      }

      if (adminApi.token) {
        try {
          const me = await adminApi.getMe();
          await applySession(me.user, me.memberships);
        } catch {
          adminApi.clearTokens();
          setCurrentUser(null);
        }
      }
      setLoading(false);
      setAuthChecked(true);
    })();

    return () => { adminApi.onSessionExpired = null; };
  }, []);

  // Socket.IO for live charger simulation events
  useEffect(() => {
    if (!selectedSocietyId || !currentUser) return;

    let closed = false;
    let retryTimer = null;

    // Token is read on every (re)connect so a refreshed token is picked up
    const socket = io('/', {
      path: '/socket.io',
      auth: (cb) => cb({ token: adminApi.token }),
    });

    // Rooms are lost on reconnect, so join on every successful connect
    socket.on('connect', () => {
      socket.emit('join_society', selectedSocietyId, (res) => {
        if (res && !res.ok) console.warn('Live updates unavailable:', res.error);
      });
    });

    // The server refuses sockets with a missing/expired token; socket.io does not
    // retry those automatically, so try again once the API layer has refreshed it.
    socket.on('connect_error', () => {
      if (closed) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (!closed) socket.connect(); }, 5000);
    });

    socket.on('charger_status_changed', (data) => {
      setChargers(prev => prev.map(c => c.id === data.chargerId ? { ...c, status: data.status } : c));
    });

    socket.on('session_update', () => {
      adminApi.getSessions(selectedSocietyId, { status: 'active' }).then(res => {
        setSessions(prev => {
          const actives = res.sessions || [];
          return [...actives, ...prev.filter(p => p.status !== 'active')];
        });
      }).catch(() => {});
    });

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      socket.disconnect();
    };
  }, [selectedSocietyId, currentUser?.id]);

  // Load active tab data
  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    try {
      if (currentUser.role === 'super_admin') {
        const sup = await adminApi.getSuperAdminDashboard().catch(() => null);
        if (sup) setSuperAdminData(sup);
        const sList = await adminApi.getAllSocieties().catch(() => ({ societies: [] }));
        setSocietiesList(sList.societies || []);
        const platSubs = await adminApi.getPlatformSubscriptions().catch(() => null);
        if (platSubs) setPlatformSubscriptions(platSubs);
      }

      if (selectedSocietyId) {
        const [dash, chg, resList, bkg, sess, tar, cmp, sub] = await Promise.all([
          adminApi.getSocietyAnalytics(selectedSocietyId).catch(() => null),
          adminApi.getChargers(selectedSocietyId).catch(() => ({ chargers: [] })),
          adminApi.getResidents(selectedSocietyId).catch(() => ({ residents: [] })),
          adminApi.getBookings(selectedSocietyId).catch(() => ({ bookings: [] })),
          adminApi.getSessions(selectedSocietyId).catch(() => ({ sessions: [] })),
          adminApi.getTariffRules(selectedSocietyId).catch(() => ({ tariffs: [] })),
          adminApi.getComplaints(selectedSocietyId).catch(() => ({ complaints: [] })),
          adminApi.getSubscription(selectedSocietyId).catch(() => null),
        ]);

        if (dash) setDashboardData(dash);
        if (chg?.chargers) setChargers(chg.chargers);
        if (resList?.residents) setResidents(resList.residents);
        if (bkg?.bookings) setBookings(bkg.bookings);
        if (sess?.sessions) setSessions(sess.sessions);
        if (tar?.tariffs) setTariffs(tar.tariffs);
        if (cmp?.complaints) setComplaints(cmp.complaints);
        if (sub) setSubscriptionData(sub);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [currentUser, selectedSocietyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Action Handlers
  const handleChargerStatusChange = async (chargerId, newStatus) => {
    try {
      await adminApi.updateChargerStatus(selectedSocietyId, chargerId, newStatus);
      showToast(`Charger updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResidentApproval = async (userId, newStatus) => {
    try {
      await adminApi.updateResident(selectedSocietyId, userId, { status: newStatus });
      showToast(`Resident ${newStatus}`);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddCharger = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await adminApi.createCharger(selectedSocietyId, {
        charger_number: form.charger_number.value,
        name: form.name.value,
        power_output_kw: parseFloat(form.power_output_kw.value),
        connector_type: form.connector_type.value,
        charging_type: form.charging_type.value,
        parking_slot: form.parking_slot.value,
      });
      showToast('Charger created successfully');
      setShowAddChargerModal(false);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateSociety = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await adminApi.createSociety({
        name: form.name.value,
        code: form.code.value,
        address: form.address.value,
        city: form.city.value,
        state: form.state.value,
        default_price_per_kwh: parseFloat(form.default_price.value) || 8.0,
      });
      showToast('Society registered');
      setShowAddSocietyModal(false);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await adminApi.broadcastNotification({
        society_id: selectedSocietyId,
        title: form.title.value,
        message: form.message.value,
        type: 'announcement',
      });
      showToast('Announcement sent to all society members');
      setShowBroadcastModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAssignAdmin = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await adminApi.assignAdmin(selectedSocietyForAdmin.id, {
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
        flat_number: form.flat.value,
      });
      showToast(`Admin assigned to ${selectedSocietyForAdmin.name}!`);
      setShowAssignAdminModal(false);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Subscription upgrade handler
  const handleConfirmUpgrade = async () => {
    if (!selectedPlanForUpgrade) return;
    try {
      const res = await adminApi.upgradeSubscription(selectedSocietyId, {
        plan_id: selectedPlanForUpgrade.id,
        billing_cycle: billingCycle,
      });
      showToast(res.message || `Upgraded to ${selectedPlanForUpgrade.name}!`);
      setShowUpgradeModal(false);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const exportCSV = (data, filename) => {
    if (!data || !data.length) {
      showToast('No data to export', 'error');
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).map(val => `"${val !== null ? val : ''}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filename}.csv`);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#070d19', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading EcoVoltX Admin…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        {toast && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? 'var(--accent-rose)' : 'var(--accent)', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600 }}>
            {toast.message}
          </div>
        )}
        <LoginScreen onLogin={handleLogin} demoMode={demoMode} demoAccounts={demoAccounts} />
      </>
    );
  }

  return (
    <div className="admin-layout">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? 'var(--accent-rose)' : 'var(--accent)',
          color: 'var(--text-primary)',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.4)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon">
            <Zap size={22} fill="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="brand-title">EcoVoltX</span>
              <span className="brand-badge">Admin</span>
            </div>
            <div className="powered-by-badge">
              Powered by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Operations</div>
          <button
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button
            className={`nav-item ${currentTab === 'chargers' ? 'active' : ''}`}
            onClick={() => setCurrentTab('chargers')}
          >
            <Zap size={18} /> Chargers
          </button>
          <button
            className={`nav-item ${currentTab === 'ocpp-config' ? 'active' : ''}`}
            onClick={() => setCurrentTab('ocpp-config')}
          >
            <Cpu size={18} /> Hardware (OCPP)
          </button>
          <button
            className={`nav-item ${currentTab === 'residents' ? 'active' : ''}`}
            onClick={() => setCurrentTab('residents')}
          >
            <Users size={18} /> Residents
          </button>
          <button
            className={`nav-item ${currentTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setCurrentTab('bookings')}
          >
            <Calendar size={18} /> Bookings
          </button>
          <button
            className={`nav-item ${currentTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setCurrentTab('sessions')}
          >
            <History size={18} /> Sessions
          </button>

          <div className="nav-section-title">Finance</div>
          <button
            className={`nav-item ${currentTab === 'payments' ? 'active' : ''}`}
            onClick={() => setCurrentTab('payments')}
          >
            <CreditCard size={18} /> Payments
          </button>
          <button
            className={`nav-item ${currentTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setCurrentTab('subscription')}
          >
            <Shield size={18} /> Plan
          </button>
          <button
            className={`nav-item ${currentTab === 'tariffs' ? 'active' : ''}`}
            onClick={() => setCurrentTab('tariffs')}
          >
            <DollarSign size={18} /> Tariffs
          </button>
          <button
            className={`nav-item ${currentTab === 'reports' ? 'active' : ''}`}
            onClick={() => setCurrentTab('reports')}
          >
            <BarChart3 size={18} /> Reports
          </button>
          <button
            className={`nav-item ${currentTab === 'logs' ? 'active' : ''}`}
            onClick={() => setCurrentTab('logs')}
          >
            <Terminal size={18} /> Integration logs
          </button>
          <button
            className={`nav-item ${currentTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setCurrentTab('announcements')}
          >
            <BellRing size={18} /> Announcements
          </button>

          {isSuperAdmin && (
            <>
              <div className="nav-section-title">Platform</div>
              <button
                className={`nav-item ${currentTab === 'platform-subscriptions' ? 'active' : ''}`}
                onClick={() => setCurrentTab('platform-subscriptions')}
              >
                <Shield size={18} /> Subscriptions
              </button>
              <button
                className={`nav-item ${currentTab === 'societies' ? 'active' : ''}`}
                onClick={() => setCurrentTab('societies')}
              >
                <Building size={18} /> Societies
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="user-pill">
              <div className="avatar">
                {currentUser?.name?.charAt(0) || 'A'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {currentUser?.name || 'Administrator'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>
                  {isSuperAdmin ? 'Super admin' : 'Society admin'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="top-header-left">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)', }}>
              {TAB_TITLES[currentTab] || currentTab}
            </h2>
            {isSuperAdmin && (
              <span style={{
                background: 'rgba(237, 237, 237, 0.06)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                Super admin
              </span>
            )}
            <span className="powered-by-badge" style={{ margin: 0 }}>
              Powered by <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
            </span>
          </div>

          <div className="top-header-right">
            {/* Society Selector */}
            {societiesList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="society-selector"
                  value={selectedSocietyId || ''}
                  onChange={(e) => {
                    const id = parseInt(e.target.value, 10);
                    setSelectedSocietyId(id);
                    setRefreshTrigger(prev => prev + 1);
                  }}
                >
                  {societiesList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setRefreshTrigger(prev => prev + 1);
                showToast('Refreshed data');
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        {/* Page Body */}
        <div className="page-body">
          {/* Demo Role Switcher Quick Bar (DEMO_MODE only) */}
          {demoMode && (
          <div className="demo-banner">
            <div className="demo-title">
              <Zap size={16} />
              <span>Demo accounts</span>
            </div>
            <div className="demo-actions">
              {demoAccounts.map(acc => (
                <button
                  key={acc.email}
                  className={`demo-btn ${currentUser?.email === acc.email ? 'active' : ''}`}
                  onClick={() => handleQuickLogin(acc.email)}
                >
                  {acc.label}
                </button>
              ))}
              <a
                href={residentAppUrl}
                target="_blank"
                rel="noreferrer"
                className="demo-btn"

              >
                Resident app ↗
              </a>
            </div>
          </div>
          )}

          {/* TAB: SUBSCRIPTIONS & PLANS (SOCIETY ADMIN) */}
          {currentTab === 'subscription' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-primary)' }}>Society SaaS Subscription</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Manage your EcoVoltX cloud platform license, charger capacity quotas, and monthly billing
                  </p>
                </div>
                {/* Billing Cycle Switcher */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  padding: '4px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: billingCycle === 'monthly' ? 'var(--accent)' : 'transparent',
                      color: billingCycle === 'monthly' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setBillingCycle('monthly')}
                  >
                    Monthly Billing
                  </button>
                  <button
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: billingCycle === 'annual' ? 'var(--accent)' : 'transparent',
                      color: billingCycle === 'annual' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setBillingCycle('annual')}
                  >
                    Annual Billing
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 500
                    }}>SAVE 20%</span>
                  </button>
                </div>
              </div>

              {/* Active Subscription Banner & Resource Quotas */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(0, 166, 81, 0.3)',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '28px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '20px',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Current Subscription</span>
                    <span className="badge badge-available">
                      <span className="status-dot available" />
                      {subscriptionData?.subscription?.status || 'Active'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {subscriptionData?.subscription?.plan_name || 'Pro Society Plan'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Next renewal on: <strong style={{ color: 'var(--text-primary)' }}>{new Date(subscriptionData?.subscription?.renews_at || Date.now() + 30 * 86400000).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Billing Cycle: {subscriptionData?.subscription?.billing_cycle?.toUpperCase() || 'MONTHLY'} • Auto-Renew Active
                  </div>
                </div>

                {/* Quota meters */}
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Charger Capacity Quota</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {subscriptionData?.usage?.active_chargers || chargers.length} / {subscriptionData?.usage?.max_chargers || 10} Chargers
                    </span>
                  </div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(100, ((subscriptionData?.usage?.active_chargers || chargers.length) / (subscriptionData?.usage?.max_chargers || 10)) * 100)}%`
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                    <span>Registered Residents: <strong style={{ color: 'var(--text-primary)' }}>{subscriptionData?.usage?.approved_residents || residents.length}</strong></span>
                    <span>Smart Load: <strong style={{ color: 'var(--accent)' }}>Enabled</strong></span>
                  </div>
                </div>
              </div>

              {/* Plan Comparison Matrix */}
              <h4 style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Plans
              </h4>

              <div className="pricing-grid">
                {(subscriptionData?.available_plans || [
                  {
                    id: 'starter',
                    name: 'Starter Community',
                    price_monthly: 1999,
                    price_annual: 19190,
                    max_chargers: 3,
                    description: 'Perfect for small gated communities starting their EV journey.',
                    features: ['Up to 3 EV Chargers', 'Resident Mobile App Access', 'Real-Time Charger Telemetry', 'Slot Booking System', 'Standard Electricity Tariff', 'Community Email Support'],
                  },
                  {
                    id: 'pro',
                    name: 'Pro Society (Recommended)',
                    price_monthly: 4999,
                    price_annual: 47990,
                    max_chargers: 10,
                    popular: true,
                    description: 'Advanced automation, dynamic tariffs, and load insights for thriving complexes.',
                    features: ['Up to 10 EV Chargers', 'All Starter Features', 'TOD Dynamic Tariffs', 'Automated Idle Penalty Fees', 'Push & In-App Announcements', 'Monthly Auto-Invoicing & Billing Logs', 'Priority Admin Phone & Chat Support'],
                  },
                  {
                    id: 'enterprise',
                    name: 'Enterprise Grid',
                    price_monthly: 9999,
                    price_annual: 95990,
                    max_chargers: 50,
                    description: 'Complete EV charging infrastructure for mega-townships and residential parks.',
                    features: ['Up to 50 Chargers (Custom Scaling)', 'All Pro Features', 'Smart Grid Load Balancing & Peak Shaving', 'RFID & OCPP Integration', 'Custom ERP/Accounting Webhooks', 'Dedicated Account Manager & 24/7 SLA', 'Co-Branding with EcoNelssol'],
                  },
                ]).map((plan) => {
                  const isCurrent = subscriptionData?.subscription?.plan_id === plan.id;
                  const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;

                  return (
                    <div
                      key={plan.id}
                      className={`pricing-card ${isCurrent ? 'current' : ''} ${plan.popular ? 'popular' : ''}`}
                    >
                      {isCurrent ? (
                        <span className="plan-badge">CURRENT PLAN</span>
                      ) : plan.popular ? (
                        <span className="plan-badge popular">MOST POPULAR</span>
                      ) : null}

                      <div>
                        <div className="plan-name">{plan.name}</div>
                        <div className="plan-desc">{plan.description}</div>

                        <div className="plan-price-box">
                          <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>₹</span>
                          <span className="plan-price">{price.toLocaleString()}</span>
                          <span className="plan-period">/ {billingCycle === 'annual' ? 'year' : 'month'}</span>
                        </div>

                        <ul className="plan-features">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="plan-feature-item">
                              <Check size={16} className="plan-feature-check" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {isCurrent ? (
                        <button className="btn btn-outline" disabled style={{ width: '100%', opacity: 0.7, cursor: 'default' }}>
                          ✓ Active Society Plan
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            background: plan.popular ? 'var(--text-secondary)' : 'var(--accent)',
                            borderColor: plan.popular ? 'var(--text-secondary)' : 'var(--accent)'
                          }}
                          onClick={() => {
                            setSelectedPlanForUpgrade(plan);
                            setShowUpgradeModal(true);
                          }}
                        >
                          Switch to {plan.name.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Past Subscription Invoices */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <History size={16} /> Plan invoices
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => exportCSV(subscriptionData?.invoices || [], 'subscription_invoices')}>
                    <Download size={14} /> Export Receipts
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice Number</th>
                        <th>Plan & Description</th>
                        <th>Amount</th>
                        <th>Billing Cycle</th>
                        <th>Period</th>
                        <th>Payment Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(subscriptionData?.invoices || []).map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invoice_number}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.plan_name}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--accent)' }}>₹{parseFloat(inv.amount).toLocaleString()}</td>
                          <td>
                            <span style={{ background: 'var(--border-color)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                              {inv.billing_cycle}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}
                          </td>
                          <td>
                            <span className="badge badge-available">
                              <span className="status-dot available" />
                              {inv.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => showToast(`Downloaded invoice ${inv.invoice_number} receipt`)}
                            >
                              <Download size={12} /> Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!subscriptionData?.invoices || subscriptionData.invoices.length === 0) && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No past invoices recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SUPER ADMIN PLATFORM SUBSCRIPTIONS (MRR / ARR) */}
          {currentTab === 'platform-subscriptions' && isSuperAdmin && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-primary)' }}>Platform Subscription Revenue</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Track multi-society recurring SaaS licenses, MRR, ARR, and society subscription health powered by EcoNelssol
                </p>
              </div>

              {/* Financial KPI Grid */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Monthly recurring revenue</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent)' }}>
                      <DollarSign size={18} />
                    </div>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--accent)' }}>
                    ₹{(platformSubscriptions?.metrics?.total_mrr || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="metric-subtitle">Active society subscriptions</div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Annual recurring revenue</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--text-secondary)' }}>
                      <BarChart3 size={18} />
                    </div>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--text-primary)' }}>
                    ₹{(platformSubscriptions?.metrics?.total_arr || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="metric-subtitle">Monthly revenue × 12</div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Subscribed societies</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--text-secondary)' }}>
                      <Building size={18} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {platformSubscriptions?.metrics?.active_subscriptions || societiesList.length}
                  </div>
                  <div className="metric-subtitle">With an active plan</div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Platform operator</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                      <Zap size={18} color="#00A651" />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 500, marginTop: '8px' }}>
                    <span className="econelssol-brand"><span className="eco">Eco</span><span className="nelssol">Nelssol</span></span>
                  </div>
                  <div className="metric-subtitle">Runs EcoVoltX</div>
                </div>
              </div>

              {/* Societies Subscription Roster */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <CreditCard size={16} /> Society subscriptions
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => exportCSV(platformSubscriptions?.societies || [], 'platform_subscriptions')}>
                    <Download size={14} /> Export Subscriptions
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Society</th>
                        <th>Code</th>
                        <th>City</th>
                        <th>Current Tier</th>
                        <th>Monthly Fee</th>
                        <th>Chargers</th>
                        <th>Renewal Date</th>
                        <th>Subscription Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(platformSubscriptions?.societies || societiesList).map((soc) => (
                        <tr key={soc.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{soc.name}</td>
                          <td>
                            <span style={{ background: 'var(--border-color)', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 500, color: 'var(--accent)' }}>
                              {soc.code}
                            </span>
                          </td>
                          <td>{soc.city || 'Bengaluru'}</td>
                          <td>
                            <span className="badge" style={{
                              background: soc.plan_id === 'enterprise' ? 'rgba(237, 237, 237, 0.06)' : soc.plan_id === 'starter' ? 'rgba(100, 116, 139, 0.2)' : 'rgba(237, 237, 237, 0.06)',
                              color: soc.plan_id === 'enterprise' ? 'var(--text-secondary)' : soc.plan_id === 'starter' ? 'var(--text-secondary)' : 'var(--accent-emerald-light)',
                            }}>
                              {soc.plan_name || (soc.id === 1 ? 'Pro Society' : 'Starter Community')}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-primary)' }}>
                            ₹{soc.price_monthly ? soc.price_monthly.toLocaleString() : (soc.id === 1 ? '4,999' : '1,999')}
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {soc.chargers_count ?? 3} / {soc.charger_limit ?? (soc.id === 1 ? 10 : 3)}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {new Date(soc.renews_at || Date.now() + 25 * 86400000).toLocaleDateString()}
                          </td>
                          <td>
                            <span className="badge badge-available">
                              <span className="status-dot available" />
                              {soc.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setSelectedSocietyId(soc.id);
                                setCurrentTab('subscription');
                                showToast(`Viewing subscription portal for ${soc.name}`);
                              }}
                            >
                              Manage Plan
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <div>
              {/* Metrics Grid */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Chargers free now</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent)' }}>
                      <Zap size={18} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {dashboardData?.overview?.available_chargers ?? chargers.filter(c => c.status === 'available').length}
                    <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>
                      {' '}of {chargers.length || 0}
                    </span>
                  </div>
                  <div className="metric-subtitle">
                    {chargers.filter(c => c.status === 'charging').length} charging now
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Energy today</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--text-secondary)' }}>
                      <BatteryCharging size={18} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {Number(dashboardData?.today?.energy_kwh ?? 0).toFixed(1)} <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>kWh</span>
                  </div>
                  <div className="metric-subtitle">
                    {dashboardData?.today?.sessions ?? 0} sessions completed
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Revenue today</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent-amber)' }}>
                      <DollarSign size={18} />
                    </div>
                  </div>
                  <div className="metric-value">
                    ₹{Number(dashboardData?.today?.revenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="metric-subtitle">
                    ₹{Number(dashboardData?.monthly?.revenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this month
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-title">Plan</span>
                    <div className="metric-icon-box" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--text-secondary)' }}>
                      <CreditCard size={18} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {subscriptionData?.subscription?.plan_name?.split(' (')[0] || '—'}
                  </div>
                  <div className="metric-subtitle">
                    Up to {subscriptionData?.usage?.max_chargers ?? '—'} chargers
                  </div>
                </div>
              </div>

              {/* Pending Approvals Alert Banner */}
              {residents.filter(r => r.status === 'pending').length > 0 && (
                <div style={{
                  background: 'rgba(237, 237, 237, 0.06)',
                  border: '1px solid rgba(237, 237, 237, 0.06)',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="status-dot charging" />
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                        {residents.filter(r => r.status === 'pending').length} {residents.filter(r => r.status === 'pending').length === 1 ? 'resident is' : 'residents are'} waiting for approval
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        They joined with your society code and can charge once approved
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setCurrentTab('residents')}
                  >
                    Review
                  </button>
                </div>
              )}

              {/* Live Chargers Quick Grid */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    Chargers
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddChargerModal(true)}>
                    <Plus size={16} /> Add charger
                  </button>
                </div>

                <div className="chargers-grid">
                  {chargers.map(charger => (
                    <div key={charger.id} className="charger-admin-card">
                      <div className="charger-header">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>
                            <span className="bay">{charger.charger_number}</span> {charger.name}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {charger.parking_location || charger.location_description}
                          </div>
                        </div>
                        <span className={`badge badge-${charger.status}`}>
                          <span className={`status-dot ${charger.status}`} />
                          {charger.status}
                        </span>
                      </div>

                      <div className="charger-specs">
                        <div className="spec-item">
                          <span className="spec-label">Power</span>
                          <span className="spec-val">{charger.power_rating_kw ?? charger.power_output_kw} kW</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Connector</span>
                          <span className="spec-val">{charger.connector_type}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Rate</span>
                          <span className="spec-val">₹{charger.price_per_kwh}/kWh</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Mode</span>
                          <span className="spec-val">{charger.integration_mode === 'PRODUCTION' ? 'Hardware' : 'Simulated'}</span>
                        </div>
                      </div>

                      <div className="charger-actions">
                        {charger.status === 'available' && (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => handleChargerStatusChange(charger.id, 'offline')}
                          >
                            Set offline
                          </button>
                        )}
                        {charger.status === 'offline' && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => handleChargerStatusChange(charger.id, 'available')}
                          >
                            Set online
                          </button>
                        )}
                        {charger.status === 'faulted' && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => handleChargerStatusChange(charger.id, 'available')}
                          >
                            Reset fault
                          </button>
                        )}
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            const newStatus = charger.status === 'maintenance' ? 'available' : 'maintenance';
                            handleChargerStatusChange(charger.id, newStatus);
                          }}
                        >
                          {charger.status === 'maintenance' ? 'End maintenance' : 'Maintenance'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active & Recent Charging Sessions */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <History size={16} /> Recent sessions
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => exportCSV(sessions, 'charging_sessions')}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>User</th>
                        <th>Charger</th>
                        <th>Status</th>
                        <th>Energy (kWh)</th>
                        <th>Cost</th>
                        <th>Start Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.slice(0, 8).map(sess => (
                        <tr key={sess.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{sess.id}</td>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sess.user_name || `User #${sess.user_id}`}</td>
                          <td>{sess.charger_number || `Charger #${sess.charger_id}`}</td>
                          <td>
                            <span className={`badge badge-${sess.status}`}>
                              <span className={`status-dot ${sess.status}`} />
                              {sess.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{sess.energy_kwh} kWh</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>₹{sess.cost}</td>
                          <td style={{ fontSize: '0.8rem' }}>{new Date(sess.start_time).toLocaleString()}</td>
                        </tr>
                      ))}
                      {sessions.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No sessions recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CHARGERS */}
          {/* TAB 2: LIVE CHARGERS & HARDWARE MANAGEMENT */}
          {currentTab === 'chargers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)' }}>Society Charging Stations & Hardware</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Configure OCPP hardware, power limits, maintenance state, and live diagnostics</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-outline" onClick={() => setCurrentTab('ocpp-config')}>
                    <Cpu size={16} /> OCPP Integration Config
                  </button>
                  <button className="btn btn-primary" onClick={() => {
                    setSelectedChargerForEdit(null);
                    setShowEditChargerModal(true);
                  }}>
                    <Plus size={16} /> Register Charger
                  </button>
                </div>
              </div>

              <div className="chargers-grid">
                {chargers.map(charger => {
                  const isOcppOnline = charger.is_ocpp_connected || charger.connectivity_status === 'online';
                  const isProduction = charger.integration_mode === 'PRODUCTION';

                  return (
                    <div key={charger.id} className="charger-admin-card" style={{ position: 'relative' }}>
                      <div className="charger-header">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 500, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                              {charger.charger_number}
                            </div>
                            {isProduction ? (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(237, 237, 237, 0.06)',
                                color: 'var(--accent)',
                                fontWeight: 500,
                              }}>
                                PRODUCTION (OCPP)
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(234, 179, 8, 0.15)',
                                color: 'var(--accent-amber)',
                                fontWeight: 500,
                              }}>
                                DEMO (SIMULATED)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {charger.name} · <span style={{ color: 'var(--text-muted)' }}>{charger.vendor || charger.manufacturer || 'EcoVoltX'} ({charger.model || 'Smart-AC'})</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge badge-${charger.status}`}>
                            <span className={`status-dot ${charger.status}`} />
                            {charger.status}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: isOcppOnline ? 'var(--accent)' : 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                            {isOcppOnline ? '● WebSocket Online' : '○ Offline'}
                          </div>
                        </div>
                      </div>

                      <div className="charger-specs">
                        <div className="spec-item">
                          <span className="spec-label">Capacity</span>
                          <span className="spec-val">{charger.power_rating_kw || charger.power_output_kw || 7.4} kW</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Rate</span>
                          <span className="spec-val">₹{charger.price_per_kwh}/kWh</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Connectors</span>
                          <span className="spec-val">{charger.connector_count || 1}x {charger.connector_type}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Location / Slot</span>
                          <span className="spec-val">{charger.parking_location || charger.parking_slot || 'Ground Bay'}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            onClick={() => {
                              setSelectedChargerForDiag(charger);
                              setShowDiagnosticsModal(true);
                            }}
                          >
                            <Activity size={14} /> Diagnostics
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            onClick={() => {
                              setSelectedChargerForEdit(charger);
                              setShowEditChargerModal(true);
                            }}
                          >
                            <Settings size={14} /> Edit Station
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {charger.status !== 'available' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ flex: 1 }}
                              onClick={() => handleChargerStatusChange(charger.id, 'available')}
                            >
                              Force Available
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => {
                              const newMode = isProduction ? 'DEMO' : 'PRODUCTION';
                              adminApi.updateCharger(selectedSocietyId, charger.id, { integration_mode: newMode })
                                .then(() => { showToast(`Charger switched to ${newMode} mode`); fetchData(); })
                                .catch(err => showToast(err.message, 'error'));
                            }}
                          >
                            Toggle Mode ({isProduction ? 'To Demo' : 'To Prod'})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: HARDWARE INTEGRATION (OCPP CONFIG) */}
          {currentTab === 'ocpp-config' && (
            <ChargerConfigTab societyId={selectedSocietyId} showToast={showToast} />
          )}

          {/* TAB: FINANCIAL TRANSACTIONS */}
          {currentTab === 'payments' && (
            <PaymentsTab
              societyId={selectedSocietyId}
              showToast={showToast}
              onOpenRefund={(p) => {
                setSelectedPaymentForRefund(p);
                setShowRefundModal(true);
              }}
              onOpenReceipt={(p) => {
                setSelectedPaymentForReceipt(p);
                setShowReceiptModal(true);
              }}
            />
          )}

          {/* TAB: INTEGRATION HEALTH & ERROR LOGS */}
          {currentTab === 'logs' && (
            <IntegrationLogsTab societyId={selectedSocietyId} showToast={showToast} />
          )}

          {/* TAB 3: RESIDENTS & APPROVALS */}
          {currentTab === 'residents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)' }}>Resident Directory & Access Control</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Approve new join requests, manage flat assignments, and monitor EV owners</p>
                </div>
                <button className="btn btn-outline" onClick={() => exportCSV(residents, 'society_residents')}>
                  <Download size={16} /> Export Residents CSV
                </button>
              </div>

              {/* Pending Approvals Section */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <UserCheck size={16} /> Waiting for approval
                  </div>
                  <span className="badge" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent-amber)' }}>
                    {residents.filter(r => r.status === 'pending').length} Pending
                  </span>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Resident</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Flat Number</th>
                        <th>Requested Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residents.filter(r => r.status === 'pending').map(resident => (
                        <tr key={resident.user_id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{resident.name}</td>
                          <td>{resident.email}</td>
                          <td>{resident.phone || 'N/A'}</td>
                          <td>
                            <span style={{ background: 'var(--border-color)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              {resident.flat_number || 'Not set'}
                            </span>
                          </td>
                          <td>{new Date(resident.created_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleResidentApproval(resident.user_id, 'approved')}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleResidentApproval(resident.user_id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {residents.filter(r => r.status === 'pending').length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No pending join requests! All residents are approved.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approved Residents */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Users size={16} /> Approved residents ({residents.filter(r => r.status === 'approved').length})
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Flat Number</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residents.filter(r => r.status === 'approved').map(res => (
                        <tr key={res.user_id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.name}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.flat_number || 'A-101'}</td>
                          <td>{res.email}</td>
                          <td>
                            <span className="badge" style={{
                              background: res.role === 'admin' ? 'rgba(237, 237, 237, 0.06)' : 'rgba(237, 237, 237, 0.06)',
                              color: res.role === 'admin' ? 'var(--text-primary)' : 'var(--accent-emerald-light)',
                            }}>
                              {res.role}
                            </span>
                          </td>
                          <td>{new Date(res.joined_at || res.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                const newFlat = prompt('Update Flat Number for ' + res.name, res.flat_number || '');
                                if (newFlat !== null) {
                                  adminApi.updateResident(selectedSocietyId, res.user_id, { flat_number: newFlat })
                                    .then(() => { showToast('Flat updated'); fetchData(); })
                                    .catch(err => showToast(err.message, 'error'));
                                }
                              }}
                            >
                              Edit Flat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BOOKINGS */}
          {currentTab === 'bookings' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Calendar size={16} /> Bookings
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => exportCSV(bookings, 'bookings_schedule')}>
                    <Download size={14} /> Export Bookings CSV
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Resident</th>
                        <th>Charger</th>
                        <th>Date & Time Slot</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontFamily: 'monospace' }}>#{b.id}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.user_name || `User #${b.user_id}`}</td>
                          <td>{b.charger_number}</td>
                          <td style={{ color: 'var(--text-primary)' }}>
                            {new Date(b.start_time).toLocaleString()} – {new Date(b.end_time).toLocaleTimeString()}
                          </td>
                          <td>
                            <span className={`badge badge-${b.status}`}>
                              <span className={`status-dot ${b.status}`} />
                              {b.status}
                            </span>
                          </td>
                          <td>{new Date(b.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {bookings.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No bookings scheduled.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CHARGING SESSIONS */}
          {currentTab === 'sessions' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <History size={16} /> All sessions
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => exportCSV(sessions, 'all_charging_sessions')}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Resident</th>
                        <th>Charger</th>
                        <th>Status</th>
                        <th>Energy (kWh)</th>
                        <th>Cost (₹)</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontFamily: 'monospace' }}>#{s.id}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.user_name || `User #${s.user_id}`}</td>
                          <td>{s.charger_number || `Charger #${s.charger_id}`}</td>
                          <td>
                            <span className={`badge badge-${s.status}`}>
                              <span className={`status-dot ${s.status}`} />
                              {s.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{s.energy_kwh} kWh</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>₹{s.cost}</td>
                          <td>{new Date(s.start_time).toLocaleString()}</td>
                          <td>{s.end_time ? new Date(s.end_time).toLocaleString() : 'In Progress'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TARIFFS & BILLING */}
          {currentTab === 'tariffs' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <DollarSign size={16} /> Tariffs
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ color: 'var(--accent)', marginBottom: '8px', fontSize: '1rem' }}>Base Tariff Rate</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>Flat energy rate charged to society residents per kWh consumed</p>
                    <div style={{ fontSize: '1.8rem', fontWeight: 500, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      ₹8.00 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ kWh</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ color: 'var(--accent-amber)', marginBottom: '8px', fontSize: '1rem' }}>Idle Penalty Policy</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>Charged when an EV remains plugged in past full charge</p>
                    <div style={{ fontSize: '1.4rem', fontWeight: 500, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      ₹50.00 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ hr (after 30m grace)</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1rem' }}>Peak Hour Multiplier (TOD)</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>TOD rate applied during high demand hours (6 PM – 10 PM)</p>
                    <div style={{ fontSize: '1.4rem', fontWeight: 500, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      1.25x <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(₹10.00 / kWh)</span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const newRate = prompt('Enter new base tariff rate (₹/kWh):', '8.50');
                    if (newRate) {
                      showToast(`Tariff updated to ₹${newRate}/kWh`);
                    }
                  }}
                >
                  Update Society Electricity Tariff
                </button>
              </div>
            </div>
          )}

          {/* TAB 7: ANALYTICS & REPORTS */}
          {currentTab === 'reports' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <BarChart3 size={16} /> Monthly consumption
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => exportCSV(dashboardData?.resident_usage || [], 'monthly_report')}>
                    <Download size={14} /> Download Monthly Report
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total kWh Consumed</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {dashboardData?.monthly?.energy_kwh ?? 142.5} kWh
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--accent)', fontFamily: 'monospace' }}>
                      ₹{dashboardData?.monthly?.revenue ?? 1140}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Session Energy</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--accent-amber)', fontFamily: 'monospace' }}>
                      18.4 kWh
                    </div>
                  </div>
                </div>

                <div className="card-title" style={{ marginBottom: '14px', fontSize: '0.95rem' }}>
                  Energy by resident, this month
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Resident</th>
                        <th>Flat</th>
                        <th>Sessions</th>
                        <th>Energy (kWh)</th>
                        <th>Total Billed (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboardData?.resident_usage || []).map((ru, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ru.name}</td>
                          <td style={{ color: 'var(--text-primary)' }}>{ru.flat_number || 'A-101'}</td>
                          <td>{ru.session_count}</td>
                          <td style={{ fontFamily: 'monospace' }}>{ru.total_energy} kWh</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>₹{ru.total_cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Complaints / Charger issues */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <AlertTriangle size={16} /> Complaints
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Resident</th>
                        <th>Charger</th>
                        <th>Subject</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: 'monospace' }}>#{c.id}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.user_name}</td>
                          <td>{c.charger_number || 'General'}</td>
                          <td style={{ color: 'var(--text-primary)' }}>{c.subject}</td>
                          <td style={{ fontSize: '0.82rem', maxWidth: '280px' }}>{c.description}</td>
                          <td>
                            <span className="badge" style={{
                              background: c.status === 'resolved' ? 'rgba(237, 237, 237, 0.06)' : 'rgba(244, 63, 94, 0.15)',
                              color: c.status === 'resolved' ? 'var(--accent)' : '#f43f5e',
                            }}>
                              {c.status}
                            </span>
                          </td>
                          <td>
                            {c.status !== 'resolved' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  const response = prompt('Enter response to resident:', 'Issue has been inspected and resolved.');
                                  if (response) {
                                    adminApi.updateComplaint(selectedSocietyId, c.id, { status: 'resolved', admin_response: response })
                                      .then(() => { showToast('Complaint resolved'); fetchData(); })
                                      .catch(err => showToast(err.message, 'error'));
                                  }
                                }}
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {complaints.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No unresolved complaints reported.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ANNOUNCEMENTS */}
          {currentTab === 'announcements' && (
            <div>
              <div className="card" style={{ maxWidth: '640px' }}>
                <div className="card-header">
                  <div className="card-title">
                    <BellRing size={16} /> Send a notice to residents
                  </div>
                </div>

                <form onSubmit={handleBroadcast}>
                  <div className="form-group">
                    <label className="form-label">Subject / Title</label>
                    <input
                      name="title"
                      className="form-input"
                      placeholder="e.g. Charger #2 Scheduled Maintenance"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Message to Residents</label>
                    <textarea
                      name="message"
                      rows="4"
                      className="form-textarea"
                      placeholder="e.g. Charger #2 will be temporarily offline today from 2:00 PM to 4:00 PM for routine firmware updates. Please use Charger #1 or #3 during this period."
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    <Send size={16} /> Broadcast to All Residents
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 9: SUPER ADMIN SOCIETIES DIRECTORY */}
          {currentTab === 'societies' && isSuperAdmin && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)' }}>Platform Societies Management</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>View all residential societies connected to the EcoVoltX cloud</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddSocietyModal(true)}>
                  <Plus size={16} /> Register New Society
                </button>
              </div>

              <div className="card">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Society Name</th>
                        <th>Code</th>
                        <th>City / State</th>
                        <th>Chargers</th>
                        <th>Residents</th>
                        <th>Subscription</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {societiesList.map(soc => (
                        <tr key={soc.id}>
                          <td style={{ fontFamily: 'monospace' }}>#{soc.id}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{soc.name}</td>
                          <td>
                            <span style={{ background: 'var(--border-color)', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 500, color: 'var(--accent)' }}>
                              {soc.code}
                            </span>
                          </td>
                          <td>{soc.city ? `${soc.city}, ${soc.state}` : 'Bengaluru, KA'}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{soc.stats?.chargers ?? 3}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{soc.stats?.members ?? 5}</td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(237, 237, 237, 0.06)', color: 'var(--accent)' }}>
                              {soc.id === 1 ? 'Pro (₹4,999)' : 'Starter (₹1,999)'}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-available">
                              <span className="status-dot available" />
                              {soc.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedSocietyId(soc.id);
                                  setCurrentTab('dashboard');
                                  showToast(`Switched view to ${soc.name}`);
                                }}
                              >
                                View Portal
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setSelectedSocietyForAdmin(soc);
                                  setShowAssignAdminModal(true);
                                }}
                              >
                                Assign Admin
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: UPGRADE SUBSCRIPTION */}
      {showUpgradeModal && selectedPlanForUpgrade && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} /> Switch to {selectedPlanForUpgrade.name}
              </h3>
              <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Selected Billing Cycle:</span>
                <span style={{ fontWeight: 500, color: 'var(--accent)', fontSize: '0.85rem' }}>{billingCycle}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Amount Due:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  ₹{(billingCycle === 'annual' ? selectedPlanForUpgrade.price_annual : selectedPlanForUpgrade.price_monthly).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              By confirming, your society will immediately upgrade to the <strong>{selectedPlanForUpgrade.name}</strong> with capacity up to <strong>{selectedPlanForUpgrade.max_chargers} EV chargers</strong> and automated invoicing powered by EcoNelssol.
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setShowUpgradeModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: 'var(--accent)', borderColor: 'var(--accent)' }}
                onClick={handleConfirmUpgrade}
              >
                Confirm & Activate Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CHARGER */}
      {showAddChargerModal && (
        <div className="modal-overlay" onClick={() => setShowAddChargerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)' }}>Add EV Charger Station</h3>
              <button className="modal-close" onClick={() => setShowAddChargerModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddCharger}>
              <div className="form-group">
                <label className="form-label">Charger Identifier (e.g. CHG-04)</label>
                <input name="charger_number" className="form-input" placeholder="CHG-04" required />
              </div>
              <div className="form-group">
                <label className="form-label">Friendly Name</label>
                <input name="name" className="form-input" placeholder="Basement Bay 4 Fast Charger" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Power Output (kW)</label>
                  <input name="power_output_kw" type="number" step="0.1" defaultValue="7.4" className="form-input" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Connector Type</label>
                  <select name="connector_type" className="form-select">
                    <option value="Type 2">Type 2 (AC)</option>
                    <option value="CCS2">CCS2 (DC Fast)</option>
                    <option value="GB/T">GB/T</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Charging Type</label>
                  <select name="charging_type" className="form-select">
                    <option value="ac">AC Level 2</option>
                    <option value="dc">DC Fast</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Parking Slot</label>
                  <input name="parking_slot" className="form-input" placeholder="Slot B2-40" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Add Charger Station
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW SOCIETY */}
      {showAddSocietyModal && (
        <div className="modal-overlay" onClick={() => setShowAddSocietyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)' }}>Register New Society</h3>
              <button className="modal-close" onClick={() => setShowAddSocietyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSociety}>
              <div className="form-group">
                <label className="form-label">Society Name</label>
                <input name="name" className="form-input" placeholder="e.g. Prestige Lakeview" required />
              </div>
              <div className="form-group">
                <label className="form-label">Society Join Code (e.g. PLV01)</label>
                <input name="code" className="form-input" placeholder="PLV01" required />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input name="address" className="form-input" placeholder="Outer Ring Road, Bellandur" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input name="city" className="form-input" defaultValue="Bengaluru" />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input name="state" className="form-input" defaultValue="Karnataka" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Electricity Rate (₹/kWh)</label>
                <input name="default_price" type="number" step="0.5" defaultValue="8.0" className="form-input" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Register Society
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN SOCIETY ADMIN */}
      {showAssignAdminModal && selectedSocietyForAdmin && (
        <div className="modal-overlay" onClick={() => setShowAssignAdminModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Assign Admin for {selectedSocietyForAdmin.name}
              </h3>
              <button className="modal-close" onClick={() => setShowAssignAdminModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAssignAdmin}>
              <div className="form-group">
                <label className="form-label">Admin Full Name</label>
                <input name="name" className="form-input" placeholder="e.g. Amit Patel" required />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Email</label>
                <input name="email" type="email" className="form-input" placeholder="admin@society.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input name="password" type="password" className="form-input" placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Flat Number</label>
                <input name="flat" className="form-input" placeholder="e.g. A-402" defaultValue="Admin Office" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Assign & Grant Admin Privileges
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / REGISTER CHARGER STATION */}
      <EditChargerModal
        isOpen={showEditChargerModal}
        onClose={() => {
          setShowEditChargerModal(false);
          setSelectedChargerForEdit(null);
        }}
        charger={selectedChargerForEdit}
        societyId={selectedSocietyId}
        showToast={showToast}
        onSuccess={() => fetchData()}
        demoMode={demoMode}
      />

      {/* MODAL: CHARGER DIAGNOSTICS & REMOTE COMMANDS */}
      <ChargerDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => {
          setShowDiagnosticsModal(false);
          setSelectedChargerForDiag(null);
        }}
        charger={selectedChargerForDiag}
        societyId={selectedSocietyId}
        showToast={showToast}
        onRefresh={() => fetchData()}
      />

      {/* MODAL: PROCESS PAYMENT REFUND */}
      <RefundModal
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setSelectedPaymentForRefund(null);
        }}
        payment={selectedPaymentForRefund}
        showToast={showToast}
        onSuccess={() => fetchData()}
      />

      {/* MODAL: OFFICIAL TAX RECEIPT VIEWER */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedPaymentForReceipt(null);
        }}
        data={selectedPaymentForReceipt}
      />
    </div>
  );
}
