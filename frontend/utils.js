/**
 * utils.js — Shared frontend utilities.
 *
 * Responsibilities:
 *  · JWT token storage & retrieval
 *  · apiFetch()   — authenticated fetch, auto-401 redirect
 *  · Route guards — requireAuth(), redirectIfLoggedIn()
 *  · UI helpers   — showToast, showSuccessTick, confirmAction
 *  · Form helpers — validateField, setFieldError, attachLiveValidation
 *  · DOM helpers  — escHtml, formatDate, setUserDisplay
 *  · Auth helpers — saveAuth, clearAuth, logout
 *  · Password toggle — initPasswordToggles
 */

"use strict";

// ── API base ──────────────────────────────────────────────────
const API = "";   // same-origin; FastAPI serves the frontend

// ── JWT storage ───────────────────────────────────────────────
const TOKEN_KEY = "kanban_token";
const USERNAME_KEY = "kanban_username";
const USER_ID_KEY = "kanban_user_id";

function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
function getUsername() { return localStorage.getItem(USERNAME_KEY) || ""; }
function isLoggedIn() { return !!localStorage.getItem(TOKEN_KEY); }

function saveAuth({ access_token, username, user_id }) {
  localStorage.setItem(TOKEN_KEY, access_token);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(USER_ID_KEY, String(user_id));
}

function clearAuth() {
  [TOKEN_KEY, USERNAME_KEY, USER_ID_KEY].forEach((k) => localStorage.removeItem(k));
}

// ── Route guards ──────────────────────────────────────────────
function requireAuth() {
  if (!isLoggedIn()) { window.location.replace("/login"); return false; }
  return true;
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) window.location.replace("/");
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  clearAuth();
  window.location.replace("/login");
}

// ── Authenticated fetch ───────────────────────────────────────
/**
 * Drop-in for fetch(). Automatically adds the Bearer token header.
 * On 401 it clears auth and redirects to /login.
 * Returns the Response object (or null if redirected).
 */
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(API + url, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.replace("/login");
    return null;
  }

  return res;
}

// ── User display ──────────────────────────────────────────────
function setUserDisplay() {
  const el = document.getElementById("userDisplay");
  const name = getUsername();
  if (el && name) el.textContent = `Hi, ${name}`;
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  if (!t) return;

  clearTimeout(_toastTimer);
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  // Force reflow so re-triggering the animation works
  void t.offsetWidth;
  t.classList.add("show");
  _toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ── Success tick overlay ──────────────────────────────────────
let _tickTimer = null;
function showSuccessTick(msg) {
  const overlay = document.getElementById("successOverlay");
  const msgEl = document.getElementById("successMsg");
  if (!overlay) return;

  clearTimeout(_tickTimer);
  if (msgEl) msgEl.textContent = msg || "Done";
  overlay.classList.add("active");

  // Re-trigger SVG animation
  const svg = overlay.querySelector(".tick-svg");
  if (svg) {
    const clone = svg.cloneNode(true);
    svg.parentNode.replaceChild(clone, svg);
  }

  _tickTimer = setTimeout(() => overlay.classList.remove("active"), 1800);
}

// ── Custom confirm dialog ─────────────────────────────────────
function confirmAction(title, msg, okText = "Delete") {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMsg");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    if (!modal) { resolve(true); return; }

    titleEl.textContent = title;
    msgEl.textContent = msg;
    okBtn.textContent = okText;
    okBtn.className = "btn " + (okText === "Delete" ? "btn-danger" : "btn-primary");

    const cleanup = (result) => {
      modal.classList.remove("active");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    modal.classList.add("active");
  });
}

// ── Validation rules ──────────────────────────────────────────
const VALIDATORS = {
  username: {
    minLength: 3, maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    messages: {
      required: "Username is required.",
      minLength: "Username must be at least 3 characters.",
      maxLength: "Username cannot exceed 50 characters.",
      pattern: "Only letters, numbers, and underscores allowed.",
    },
  },
  password: {
    minLength: 6,
    maxLength: 72,
    messages: {
      required: "Password is required.",
      minLength: "Password must be at least 6 characters.",
      maxLength: "Password cannot exceed 72 characters.",
    },
  },
  boardName: {
    minLength: 1, maxLength: 80,
    messages: {
      required: "Board name is required.",
      maxLength: "Board name cannot exceed 80 characters.",
    },
  },
  boardDesc: {
    maxLength: 500,
    messages: { maxLength: "Description cannot exceed 500 characters." },
  },
  taskTitle: {
    minLength: 1, maxLength: 120,
    messages: {
      required: "Task title is required.",
      maxLength: "Title cannot exceed 120 characters.",
    },
  },
  taskDesc: {
    maxLength: 1000,
    messages: { maxLength: "Description cannot exceed 1000 characters." },
  },
};

/**
 * Validate a field value. Returns an error string or null.
 * @param {string} fieldName
 * @param {string} value
 */
function validateField(fieldName, value) {
  const v = (value || "").trim();
  const rules = VALIDATORS[fieldName];
  if (!rules) return null;

  if (rules.minLength && rules.minLength >= 1 && v.length === 0)
    return rules.messages.required || "Required.";

  if (rules.pattern && v.length > 0 && !rules.pattern.test(v))
    return rules.messages.pattern;

  if (rules.minLength && v.length > 0 && v.length < rules.minLength)
    return rules.messages.minLength;

  if (rules.maxLength && v.length > rules.maxLength)
    return rules.messages.maxLength;

  return null;
}

/**
 * Show or clear an inline error beneath an input/textarea.
 * @param {HTMLElement} input
 * @param {string|null} msg
 */
function setFieldError(input, msg) {
  if (!input) return;
  // Walk up past .password-wrapper to the real .form-group container
  let container = input.parentElement;
  if (container && container.classList.contains("password-wrapper")) {
    container = container.parentElement;
  }
  let hint = container ? container.querySelector(".field-error") : null;

  if (!hint) {
    hint = document.createElement("span");
    hint.className = "field-error";
    if (container) container.appendChild(hint);
  }

  if (msg) {
    hint.textContent = msg;
    input.setAttribute("aria-invalid", "true");
    input.classList.add("input-error");
  } else {
    hint.textContent = "";
    input.removeAttribute("aria-invalid");
    input.classList.remove("input-error");
  }
}

/**
 * Wire live blur/input validation to an input element.
 */
function attachLiveValidation(el, fieldName) {
  if (!el) return;
  const validate = () => setFieldError(el, validateField(fieldName, el.value));
  el.addEventListener("blur", validate);
  el.addEventListener("input", () => {
    if (el.classList.contains("input-error")) validate();
  });
}

// ── Formatting helpers ────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return "—"; }
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Password visibility toggle ────────────────────────────────
const SVG_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
  viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>`;

const SVG_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
  viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
  <line x1="1" y1="1" x2="23" y2="23"/>
</svg>`;

function initPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrapper = btn.closest(".password-wrapper");
      const input = wrapper?.querySelector("input") || btn.previousElementSibling;
      const icon = btn.querySelector(".eye-icon");
      if (!input || !icon) return;

      if (input.type === "password") {
        input.type = "text";
        icon.innerHTML = SVG_EYE_OFF;
      } else {
        input.type = "password";
        icon.innerHTML = SVG_EYE;
      }
    });
  });
}

// ── Run on every page ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setUserDisplay();
  initPasswordToggles();
});
