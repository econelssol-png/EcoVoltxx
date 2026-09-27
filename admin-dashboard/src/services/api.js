/**
 * Admin API Service — Centralized HTTP client for SocietyCharge Admin Portal
 */

const API_BASE = '/api';

class AdminApiService {
  constructor() {
    this.token = localStorage.getItem('sc_admin_token');
    this.refreshToken = localStorage.getItem('sc_admin_refresh_token');
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) localStorage.setItem('sc_admin_token', accessToken);
    if (refreshToken) localStorage.setItem('sc_admin_refresh_token', refreshToken);
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('sc_admin_token');
    localStorage.removeItem('sc_admin_refresh_token');
    localStorage.removeItem('sc_admin_user');
    localStorage.removeItem('sc_admin_society');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      let res = await fetch(url, { ...options, headers });

      if (res.status === 401 && this.refreshToken && !endpoint.includes('/auth/refresh')) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.token}`;
          res = await fetch(url, { ...options, headers });
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `Request failed (${res.status})`);
      }

      return await res.json();
    } catch (err) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  }

  async refreshAccessToken() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        this.setTokens(data.accessToken, data.refreshToken);
        return true;
      }
      this.clearTokens();
      return false;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  // Auth
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // Super Admin Endpoints
  getSuperAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  getAllSocieties() {
    return this.request('/admin/societies');
  }

  createSociety(data) {
    return this.request('/admin/societies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getSocietyDetails(id) {
    return this.request(`/admin/societies/${id}`);
  }

  updateSociety(id, data) {
    return this.request(`/admin/societies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  assignAdmin(societyId, data) {
    return this.request(`/admin/societies/${societyId}/assign-admin`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Society Admin Endpoints
  getSocietyAnalytics(societyId) {
    return this.request(`/societies/${societyId}/analytics`);
  }

  getChargers(societyId) {
    return this.request(`/societies/${societyId}/chargers`);
  }

  createCharger(societyId, data) {
    return this.request(`/societies/${societyId}/chargers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateCharger(societyId, chargerId, data) {
    return this.request(`/societies/${societyId}/chargers/${chargerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  updateChargerStatus(societyId, chargerId, status) {
    return this.request(`/societies/${societyId}/chargers/${chargerId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  getResidents(societyId) {
    return this.request(`/societies/${societyId}/residents`);
  }

  updateResident(societyId, userId, data) {
    return this.request(`/societies/${societyId}/residents/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  getResidentHistory(societyId, userId) {
    return this.request(`/societies/${societyId}/residents/${userId}/history`);
  }

  getBookings(societyId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/societies/${societyId}/bookings${qs ? '?' + qs : ''}`);
  }

  getSessions(societyId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/societies/${societyId}/sessions${qs ? '?' + qs : ''}`);
  }

  getBillingSummary(societyId) {
    return this.request(`/societies/${societyId}/billing/summary`);
  }

  getTariffRules(societyId) {
    return this.request(`/societies/${societyId}/billing/tariffs`);
  }

  updateTariffRule(societyId, data) {
    return this.request(`/societies/${societyId}/billing/tariffs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getComplaints(societyId) {
    return this.request(`/societies/${societyId}/complaints`);
  }

  updateComplaint(societyId, complaintId, data) {
    return this.request(`/societies/${societyId}/complaints/${complaintId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  broadcastNotification(data) {
    return this.request('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Subscription Endpoints
  getSubscription(societyId) {
    return this.request(`/societies/${societyId}/subscription`);
  }

  upgradeSubscription(societyId, data) {
    return this.request(`/societies/${societyId}/subscription/upgrade`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getPlatformSubscriptions() {
    return this.request('/admin/subscriptions/platform/overview');
  }
}

export const adminApi = new AdminApiService();
export default adminApi;
