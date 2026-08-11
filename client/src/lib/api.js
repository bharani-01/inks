/**
 * API client — mirrors public/js/api.js behavior for the React SPA.
 * Token + user live in localStorage under the same keys the backend/legacy app use.
 */

export const API_BASE = '/api';

const TOKEN_KEY = 'printa_token';
const USER_KEY = 'printa_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

export function dashboardPath(user) {
  if (!user) return '/user/print';
  if (user.role === 'ADMIN') return '/admin/dashboard';
  if (user.role === 'PRINTER_ADMIN') return '/printer/orders';
  return '/user/print';
}

/**
 * Optional hook invoked on a 401 so the app can surface a toast + redirect.
 * AuthContext registers this at startup.
 */
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function handleUnauthorized() {
  clearAuth();
  if (onUnauthorized) {
    onUnauthorized();
  } else if (!window.location.pathname.includes('login')) {
    window.location.href = '/login';
  }
}

async function request(method, endpoint, body) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, opts);

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized();
    }
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

/**
 * Multipart upload with real progress via XHR (fetch can't report upload progress).
 * onProgress receives (percent, loadedBytes, totalBytes).
 */
export function uploadFile(endpoint, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${endpoint}`, true);

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      let res = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        res = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(res);
      } else {
        if (xhr.status === 401) handleUnauthorized();
        reject(new Error(res.message || 'Upload failed'));
      }
    };

    xhr.onerror = () => reject(new Error('Network upload error'));
    xhr.send(formData);
  });
}

/** Absolute-safe preview URL (token in query string, matches legacy behavior). */
export function previewUrl(docId, { download = false } = {}) {
  const token = getToken();
  const params = new URLSearchParams();
  if (download) params.set('download', 'true');
  if (token) params.set('token', token);
  return `${API_BASE}/documents/${docId}/preview?${params.toString()}`;
}

/** Authenticated download URL for order PDF invoice */
export function invoiceUrl(orderId) {
  const token = getToken();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  return `${API_BASE}/orders/${orderId}/invoice?${params.toString()}`;
}

/** Authenticated URL for order QR Cover Page PDF */
export function coverPageUrl(orderId) {
  const token = getToken();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  return `${API_BASE}/orders/admin/${orderId}/cover-page?${params.toString()}`;
}

/** Authenticated URL for complete Print-Ready PDF with First & Last Cover Pages auto-attached */
export function printReadyUrl(orderId, { download = false } = {}) {
  const token = getToken();
  const params = new URLSearchParams();
  if (download) params.set('download', 'true');
  if (token) params.set('token', token);
  return `${API_BASE}/orders/admin/${orderId}/print-ready?${params.toString()}`;
}

export const api = {
  get: (endpoint) => request('GET', endpoint),
  post: (endpoint, body) => request('POST', endpoint, body),
  put: (endpoint, body) => request('PUT', endpoint, body),
  del: (endpoint) => request('DELETE', endpoint),
  uploadFile,
};
