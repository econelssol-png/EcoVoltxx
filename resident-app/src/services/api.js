/**
 * API Service — Centralized HTTP client for SocietyCharge
 */

const API_BASE = '/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('sc_token');
    this.refreshToken = localStorage.getItem('sc_refresh_token');
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('sc_token', accessToken);
    localStorage.setItem('sc_refresh_token', refreshToken);
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_refresh_token');
    localStorage.removeItem('sc_user');
    localStorage.removeItem('sc_society');
  }

  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        const data = await response.json();
        if (data.code === 'TOKEN_EXPIRED' && this.refreshToken) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            headers['Authorization'] = `Bearer ${this.token}`;
            return fetch(url, { ...options, headers }).then(r => r.json());
          }
        }
        this.clearTokens();
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Request failed');
      }
      return json;
    } catch (err) {
      if (err.message === 'Authentication failed') throw err;
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
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
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

  register(name, email, phone, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password }),
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // Societies
  getSocieties() {
    return this.request('/societies');
  }

  getSociety(id) {
    return this.request(`/societies/${id}`);
  }

  lookupSociety(code) {
    return this.request(`/societies/lookup/${code}`);
  }

  joinSociety(id, code, flatNumber) {
    return this.request(`/societies/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ code, flat_number: flatNumber }),
    });
  }

  // Chargers
  getChargers(societyId) {
    return this.request(`/societies/${societyId}/chargers`);
  }

  getCharger(societyId, chargerId) {
    return this.request(`/societies/${societyId}/chargers/${chargerId}`);
  }

  // Bookings
  getBookings(societyId, params = '') {
    return this.request(`/societies/${societyId}/bookings${params ? '?' + params : ''}`);
  }

  createBooking(societyId, data) {
    return this.request(`/societies/${societyId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  cancelBooking(societyId, bookingId) {
    return this.request(`/societies/${societyId}/bookings/${bookingId}`, {
      method: 'DELETE',
    });
  }

  // Sessions
  getSessions(societyId, params = '') {
    return this.request(`/societies/${societyId}/sessions${params ? '?' + params : ''}`);
  }

  startSession(societyId, chargerId, bookingId) {
    return this.request(`/societies/${societyId}/sessions/start`, {
      method: 'POST',
      body: JSON.stringify({ charger_id: chargerId, booking_id: bookingId }),
    });
  }

  stopSession(societyId, sessionId) {
    return this.request(`/societies/${societyId}/sessions/${sessionId}/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Billing
  getBilling(societyId) {
    return this.request(`/societies/${societyId}/billing`);
  }

  // Notifications
  getNotifications() {
    return this.request('/notifications');
  }

  markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  // Profile
  getProfile() {
    return this.request('/profile');
  }

  updateProfile(data) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  getVehicles() {
    return this.request('/profile/vehicles');
  }

  addVehicle(data) {
    return this.request('/profile/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Complaints
  getComplaints(societyId) {
    return this.request(`/societies/${societyId}/complaints`);
  }

  createComplaint(societyId, data) {
    return this.request(`/societies/${societyId}/complaints`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payments
  createPayment(data) {
    return this.request('/payments/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin
  getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  getAdminSocieties() {
    return this.request('/admin/societies');
  }

  createSociety(data) {
    return this.request('/admin/societies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  getAdminSocietyDetails(id) {
    return this.request(`/admin/societies/${id}`);
  }

  // Society Admin
  getResidents(societyId) {
    return this.request(`/societies/${societyId}/residents`);
  }

  updateResident(societyId, userId, data) {
    return this.request(`/societies/${societyId}/residents/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  getAnalytics(societyId) {
    return this.request(`/societies/${societyId}/analytics`);
  }

  getAllBilling(societyId, month, year) {
    return this.request(`/societies/${societyId}/billing/all?month=${month}&year=${year}`);
  }

  generateInvoices(societyId, month, year) {
    return this.request(`/societies/${societyId}/billing/generate`, {
      method: 'POST',
      body: JSON.stringify({ month, year }),
    });
  }

  // Charger admin
  addCharger(societyId, data) {
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
}

const api = new ApiService();
export default api;
