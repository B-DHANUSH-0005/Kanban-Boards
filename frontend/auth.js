/**
 * auth.js — Login, registration, and forgot-password flow.
 * All shared utilities are loaded from utils.js (must be first in HTML).
 *
 * Password-toggle is already wired by utils.js DOMContentLoaded —
 * do NOT call initPasswordToggles() again here.
 */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Skip auth pages if already logged in
  redirectIfLoggedIn();

  // ── Login ───────────────────────────────────────────────────
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    // Show redirect success message (e.g. "Account created! Please log in.")
    const successEl = document.getElementById("loginSuccess");
    const urlMsg = new URLSearchParams(window.location.search).get("message");
    if (urlMsg && successEl) {
      successEl.textContent = urlMsg;
      successEl.classList.add("show");
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Look up elements inside the handler — guaranteed to exist at this point
      const emailEl    = document.getElementById("email_id");
      const passwordEl = document.getElementById("password");
      const errorEl    = document.getElementById("loginError");
      const successEl2 = document.getElementById("loginSuccess");

      if (errorEl)  errorEl.classList.remove("show");
      if (successEl2) successEl2.classList.remove("show");

      const email_id = emailEl ? emailEl.value.trim() : "";
      const password = passwordEl ? passwordEl.value : "";

      if (!email_id) { setFieldError(emailEl, "Email is required."); return; }
      if (!password) { setFieldError(passwordEl, "Password is required."); return; }
      setFieldError(emailEl, null);
      setFieldError(passwordEl, null);

      const btn = loginForm.querySelector("[type=submit]");
      btn.disabled    = true;
      btn.textContent = "Logging in…";

      try {
        const res  = await fetch(`${API}/auth/login`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email_id, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (errorEl) { errorEl.textContent = data.detail || "Invalid email or password."; errorEl.classList.add("show"); }
          return;
        }

        saveAuth(data);
        window.location.replace("/");

      } catch {
        if (errorEl) { errorEl.textContent = "Unable to reach server. Please try again."; errorEl.classList.add("show"); }
      } finally {
        btn.disabled    = false;
        btn.textContent = "Log In";
      }
    });

    // ── Forgot Password ──────────────────────────────────────
    initForgotPassword();
  }

  // ── Register ────────────────────────────────────────────────
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Look up elements inside the handler — guaranteed to exist here
      const emailEl    = document.getElementById("email_id");
      const passwordEl = document.getElementById("password");
      const errorEl    = document.getElementById("registerError");

      if (errorEl) errorEl.classList.remove("show");

      const email_id = emailEl ? emailEl.value.trim() : "";
      const password = passwordEl ? passwordEl.value : "";

      // Validation
      if (!email_id) { setFieldError(emailEl, "Email is required."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_id)) {
        setFieldError(emailEl, "Please enter a valid email address."); return;
      }
      if (!password || password.length < 6) {
        setFieldError(passwordEl, "Password must be at least 6 characters."); return;
      }
      setFieldError(emailEl, null);
      setFieldError(passwordEl, null);

      const btn = registerForm.querySelector("[type=submit]");
      btn.disabled    = true;
      btn.textContent = "Creating account…";

      try {
        const res  = await fetch(`${API}/auth/register`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email_id, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (errorEl) { errorEl.textContent = data.detail || "Registration failed. Please try again."; errorEl.classList.add("show"); }
          return;
        }

        window.location.replace(`/login?message=${encodeURIComponent("Account created! You can now log in.")}`);

      } catch {
        if (errorEl) { errorEl.textContent = "Unable to reach server. Please try again."; errorEl.classList.add("show"); }
      } finally {
        btn.disabled    = false;
        btn.textContent = "Create Account";
      }
    });
  }
});

// ── Forgot-Password Flow ─────────────────────────────────────
function initForgotPassword() {
  const modal      = document.getElementById("forgotModal");
  const step1      = document.getElementById("fpStep1");
  const step2      = document.getElementById("fpStep2");
  const step3      = document.getElementById("fpStep3");
  if (!modal) return;

  // Elements — step 1
  const fpEmail     = document.getElementById("fpEmail");
  const fpEmailErr  = document.getElementById("fpEmailError");
  const fpSendBtn   = document.getElementById("fpSendBtn");
  const fpCancelBtn = document.getElementById("fpCancelBtn");

  // Elements — step 2
  const fpEmailDisplay = document.getElementById("fpEmailDisplay");
  const fpCode         = document.getElementById("fpCode");
  const fpCodeErr      = document.getElementById("fpCodeError");
  const fpVerifyBtn    = document.getElementById("fpVerifyBtn");
  const fpResendBtn    = document.getElementById("fpResendBtn");

  // Elements — step 3
  const fpNewPassword = document.getElementById("fpNewPassword");
  const fpResetErr    = document.getElementById("fpResetError");
  const fpSaveBtn     = document.getElementById("fpSaveBtn");

  // Remembered state across steps
  let _email = "";
  let _code  = "";
  let _timerInterval = null;
  const fpTimerDisplay = document.getElementById("fpTimerDisplay");
  
  function startResendTimer() {
    clearInterval(_timerInterval);
    let timeLeft = 30;
    fpResendBtn.disabled = true;
    if (fpTimerDisplay) {
      fpTimerDisplay.textContent = `Resend available in: ${timeLeft}s`;
      fpTimerDisplay.style.color = "var(--text-muted)";
    }

    _timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(_timerInterval);
        if (fpTimerDisplay) {
          fpTimerDisplay.textContent = "You can now resend.";
          fpTimerDisplay.style.color = "var(--text-primary)";
        }
        fpResendBtn.disabled = false;
      } else {
        if (fpTimerDisplay) fpTimerDisplay.textContent = `Resend available in: ${timeLeft}s`;
      }
    }, 1000);
  }

  // Re-init toggle for the new-password field in step 3
  // (utils.js runs initPasswordToggles on DOMContentLoaded which covers static toggles;
  //  step3 is hidden but in the DOM so it's already covered.)

  function openModal() {
    _email = "";
    _code  = "";
    clearInterval(_timerInterval);
    if (fpTimerDisplay) fpTimerDisplay.textContent = "";
    fpEmail.value       = "";
    fpCode.value        = "";
    fpNewPassword.value = "";
    clearAlert(fpEmailErr);
    clearAlert(fpCodeErr);
    clearAlert(fpResetErr);
    showStep(1);
    modal.classList.add("active");
    fpEmail.focus();
  }

  function closeModal() {
    modal.classList.remove("active");
  }

  function showStep(n) {
    step1.style.display = n === 1 ? "" : "none";
    step2.style.display = n === 2 ? "" : "none";
    step3.style.display = n === 3 ? "" : "none";
  }

  function clearAlert(el) {
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  }

  function showAlert(el, msg) {
    if (el) { el.textContent = msg; el.classList.add("show"); }
  }

  // Open / close
  document.getElementById("forgotPasswordBtn").addEventListener("click", openModal);
  fpCancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // ── Step 1 — Send code ──────────────────────────────────────
  fpSendBtn.addEventListener("click", async () => {
    clearAlert(fpEmailErr);
    const email = fpEmail.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert(fpEmailErr, "Please enter a valid email address."); return;
    }

    fpSendBtn.disabled    = true;
    fpSendBtn.textContent = "Sending…";

    try {
      const res  = await fetch(`${API}/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email_id: email }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert(fpEmailErr, data.detail || "Failed to send code."); return;
      }

      _email = email;
      fpEmailDisplay.textContent = email;
      fpCode.value = "";
      clearAlert(fpCodeErr);
      showStep(2);
      startResendTimer();
      fpCode.focus();

    } catch {
      showAlert(fpEmailErr, "Unable to reach server. Please try again.");
    } finally {
      fpSendBtn.disabled    = false;
      fpSendBtn.textContent = "Send Code";
    }
  });

  // ── Resend ──────────────────────────────────────────────────
  fpResendBtn.addEventListener("click", async () => {
    clearAlert(fpCodeErr);
    fpResendBtn.disabled    = true;
    fpResendBtn.textContent = "Sending…";

    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email_id: _email }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert(fpCodeErr, data.detail || "Failed to resend."); return; }
      showAlert(fpCodeErr, "A new code has been sent! Check your inbox.");
      fpCodeErr.classList.add("show");
      fpCodeErr.style.color = "green";
      startResendTimer();
    } catch {
      showAlert(fpCodeErr, "Unable to reach server.");
    } finally {
      fpResendBtn.disabled    = false;
      fpResendBtn.textContent = "Resend";
    }
  });

  // ── Step 2 — Verify code ────────────────────────────────────
  fpVerifyBtn.addEventListener("click", async () => {
    clearAlert(fpCodeErr);
    const code = fpCode.value.trim();
    if (!code || !/^\d{4}$/.test(code)) {
      showAlert(fpCodeErr, "Please enter the 4-digit code."); return;
    }

    fpVerifyBtn.disabled    = true;
    fpVerifyBtn.textContent = "Verifying…";

    try {
      const res  = await fetch(`${API}/auth/verify-code`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email_id: _email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert(fpCodeErr, data.detail || "Incorrect code."); return;
      }

      clearInterval(_timerInterval);
      _code = code;
      fpNewPassword.value = "";
      clearAlert(fpResetErr);
      showStep(3);
      fpNewPassword.focus();

    } catch {
      showAlert(fpCodeErr, "Unable to reach server. Please try again.");
    } finally {
      fpVerifyBtn.disabled    = false;
      fpVerifyBtn.textContent = "Verify Code";
    }
  });

  // Allow pressing Enter on the code field
  fpCode.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fpVerifyBtn.click();
  });

  // ── Step 3 — Save password ──────────────────────────────────
  fpSaveBtn.addEventListener("click", async () => {
    clearAlert(fpResetErr);
    const newPwd = fpNewPassword.value;
    if (!newPwd || newPwd.length < 6) {
      showAlert(fpResetErr, "Password must be at least 6 characters."); return;
    }

    fpSaveBtn.disabled    = true;
    fpSaveBtn.textContent = "Saving…";

    try {
      const res  = await fetch(`${API}/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email_id: _email, code: _code, new_password: newPwd }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert(fpResetErr, data.detail || "Failed to reset password."); return;
      }

      closeModal();
      // Show success on the login page and pre-fill the email
      const successEl = document.getElementById("loginSuccess");
      if (successEl) {
        successEl.textContent = "Password updated! Please log in with your new password.";
        successEl.classList.add("show");
      }
      const emailEl = document.getElementById("email_id");
      if (emailEl) emailEl.value = _email;

    } catch {
      showAlert(fpResetErr, "Unable to reach server. Please try again.");
    } finally {
      fpSaveBtn.disabled    = false;
      fpSaveBtn.textContent = "Save Password";
    }
  });
}
