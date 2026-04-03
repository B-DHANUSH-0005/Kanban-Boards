/**
 * config.js — Single source of truth for all constants.
 * Never hardcode values in components — import from here.
 */

/* ── Storage Keys ─────────────────────────────────────────── */
export const STORAGE_KEYS = {
  TOKEN: 'kanban_token',
  USERNAME: 'kanban_username',
  USER_ID: 'kanban_user_id',
  BOARDS_CACHE: 'kb_boards_list',
};

/* ── Pagination ───────────────────────────────────────────── */
export const PAGE_SIZE = 12;

/* ── Polling Intervals (ms) ───────────────────────────────── */
export const POLL_INTERVALS = {
  DASHBOARD: 30_000,
  BOARD: 15_000,
};

/* ── Validation Rules ─────────────────────────────────────── */
export const VALIDATION = {
  EMAIL: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },
  PASSWORD: {
    minLength: 6,
    maxLength: 72,
    messages: {
      required: 'Password is required',
      minLength: 'Password must be at least 6 characters',
      maxLength: 'Password cannot exceed 72 characters',
    },
  },
  BOARD_NAME: {
    minLength: 1,
    maxLength: 80,
    messages: {
      required: 'Board name is required',
      maxLength: 'Board name cannot exceed 80 characters',
    },
  },
  BOARD_DESC: {
    maxLength: 500,
    messages: {
      maxLength: 'Description cannot exceed 500 characters',
    },
  },
  TASK_TITLE: {
    minLength: 1,
    maxLength: 120,
    messages: {
      required: 'Task title is required',
      maxLength: 'Title cannot exceed 120 characters',
    },
  },
  TASK_DESC: {
    maxLength: 1000,
    messages: {
      maxLength: 'Description cannot exceed 1000 characters',
    },
  },
};

/* ── Helpers ──────────────────────────────────────────────── */
export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function statusLabel(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

export function validateField(rules, value) {
  const v = (value || '').trim();
  if (rules.minLength && rules.minLength >= 1 && v.length === 0) {
    return rules.messages.required || 'Required';
  }
  if (rules.minLength && v.length > 0 && v.length < rules.minLength) {
    return rules.messages.minLength;
  }
  if (rules.maxLength && v.length > rules.maxLength) {
    return rules.messages.maxLength;
  }
  return null;
}
