/**
 * api.js — All API calls in one place.
 * Components never call fetch() directly — they call these functions.
 */
import { STORAGE_KEYS, PAGE_SIZE } from '../constants/config';

/* ── Base fetch with JWT injection ────────────────────────── */
function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized
    if (res.status === 401) {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      // Only redirect if not already on login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
      return null;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.detail || 'Something went wrong');
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    throw err;
  }
}

/* ── Auth endpoints (no JWT needed for most) ───────────────── */
export const authAPI = {
  async login(email_id, password) {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    return data;
  },

  async register(email_id, password) {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    return data;
  },

  forgotPassword(email_id) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email_id }),
    });
  },

  verifyCode(email_id, code) {
    return apiFetch('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email_id, code }),
    });
  },

  resetPassword(email_id, code, new_password) {
    return apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email_id, code, new_password }),
    });
  },
};

/* ── Boards endpoints ─────────────────────────────────────── */
export const boardsAPI = {
  list(page = 1, pageSize = PAGE_SIZE, search = '') {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (search) params.set('search', search);
    return apiFetch(`/boards?${params}`);
  },

  get(id) {
    return apiFetch(`/boards/${id}`);
  },

  create(name, description) {
    return apiFetch('/boards', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  update(id, data) {
    return apiFetch(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id) {
    return apiFetch(`/boards/${id}`, { method: 'DELETE' });
  },

  merge(sourceId, targetBoardId) {
    return apiFetch(`/boards/${sourceId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ target_board_id: targetBoardId }),
    });
  },

  bundle(id) {
    return apiFetch(`/boards/${id}/bundle`);
  },
};

/* ── Tasks endpoints ──────────────────────────────────────── */
export const tasksAPI = {
  create(boardId, title, description, status) {
    return apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        board_id: boardId,
        title,
        description,
        status,
      }),
    });
  },

  update(id, data) {
    return apiFetch(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id) {
    return apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  },

  move(id, status) {
    return apiFetch(`/tasks/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};
