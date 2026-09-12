import axios from 'axios';

// In production (e.g. Vercel), set VITE_API_BASE_URL to the deployed backend's
// URL (e.g. https://ledgio-backend.onrender.com/api/v1). Falls back to the
// local dev backend when unset.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to inject the Auth Token and Tenant ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accountgo-token');
    const tenantId = localStorage.getItem('accountgo-tenant-id');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept responses to handle global authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accountgo-token');
      localStorage.removeItem('accountgo-tenant-id');

      // A 401 from /auth/login just means "wrong credentials" — handled inline.
      // A 401 from any /admin/* path belongs to the admin/team portal auth
      // system, which manages its own session (team token stored in
      // sessionStorage). Neither case should trigger a user-session tear-down.
      // Every other 401 means the regular user Bearer token went stale —
      // dispatch the event so AuthContext can force a clean logout + redirect.
      const url = typeof error.config?.url === 'string' ? error.config.url : '';
      const isLoginRequest = url.includes('/auth/login');
      const isAdminRequest = url.includes('/admin/');
      if (!isLoginRequest && !isAdminRequest) {
        window.dispatchEvent(new Event('ledgio:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);
