/**
 * Printa — API Client
 * Fetch wrapper with JWT auto-attach and error handling
 */
const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('printa_token');
  },
  setToken(token) {
    localStorage.setItem('printa_token', token);
  },
  clearToken() {
    localStorage.removeItem('printa_token');
    localStorage.removeItem('printa_user');
  },
  getUser() {
    const data = localStorage.getItem('printa_user');
    return data ? JSON.parse(data) : null;
  },
  setUser(user) {
    localStorage.setItem('printa_user', JSON.stringify(user));
  },

  async request(method, endpoint, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body && method !== 'GET') options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        if (!window.location.pathname.includes('login')) {
          showToast('Session expired. Please login again.', 'warning');
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        }
      }
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  },

  /**
   * Upload file via FormData (no JSON content-type)
   */
  async uploadFile(endpoint, formData) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        if (!window.location.pathname.includes('login')) {
          showToast('Session expired. Please login again.', 'warning');
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        }
      }
      throw new Error(data.message || 'Upload failed');
    }
    return data;
  },

  get(endpoint) { return this.request('GET', endpoint); },
  post(endpoint, body) { return this.request('POST', endpoint, body); },
  put(endpoint, body) { return this.request('PUT', endpoint, body); },
  delete(endpoint) { return this.request('DELETE', endpoint); },
};

/**
 * Toast Notification System — SVG icons only
 */
const toastIcons = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

function initToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

function showToast(message, type = 'success', duration = 4000) {
  initToastContainer();
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${toastIcons[type] || toastIcons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function isAuthenticated() {
  return !!api.getToken();
}

function logout() {
  api.clearToken();
  window.location.href = '/login';
}

/**
 * Get redirect path based on user role
 */
function getDashboardPath(user) {
  if (user && user.role === 'ADMIN') return '/admin/dashboard';
  return '/user/print';
}
