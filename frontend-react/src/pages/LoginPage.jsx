import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { authAPI } from '../services/api';
import { VALIDATION } from '../constants/config';
import PasswordInput from '../components/PasswordInput';
import Modal from '../components/Modal';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* Redirect if already logged in */
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  /* ── Login form state ───────────────────────────────────── */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  /* Show success from redirect (e.g. after registration) */
  useEffect(() => {
    const msg = searchParams.get('message');
    if (msg) setSuccessMsg(msg);
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    try {
      const data = await authAPI.login(email.trim(), password);
      login(data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Forgot Password Modal ──────────────────────────────── */
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStep, setFpStep] = useState(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpTimer, setFpTimer] = useState(0);
  const timerRef = useRef(null);

  const startResendTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setFpTimer(30);
    timerRef.current = setInterval(() => {
      setFpTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const openForgotPassword = () => {
    setFpStep(1);
    setFpEmail(email.trim());
    setFpCode('');
    setFpNewPassword('');
    setFpError('');
    setFpTimer(0);
    clearInterval(timerRef.current);
    setFpOpen(true);
  };

  const closeForgotPassword = () => {
    setFpOpen(false);
    clearInterval(timerRef.current);
  };

  /* Step 1: Send code */
  const handleSendCode = async () => {
    setFpError('');
    if (!fpEmail.trim() || !VALIDATION.EMAIL.pattern.test(fpEmail.trim())) {
      setFpError('Please enter a valid email address.');
      return;
    }

    setFpLoading(true);
    try {
      await authAPI.forgotPassword(fpEmail.trim());
      setFpStep(2);
      setFpError(''); // Explicit clear on success
      startResendTimer();
    } catch (err) {
      setFpError(err.message || 'Failed to send code.');
    } finally {
      setFpLoading(false);
    }
  };

  /* Resend code */
  const handleResend = async () => {
    setFpError('');
    setFpLoading(true);
    try {
      await authAPI.forgotPassword(fpEmail.trim());
      showToast('New code sent! Check your inbox.');
      startResendTimer();
    } catch (err) {
      setFpError(err.message || 'Failed to resend.');
    } finally {
      setFpLoading(false);
    }
  };

  /* Step 2: Verify code */
  const handleVerifyCode = async () => {
    setFpError('');
    if (!fpCode.trim() || !/^\d{4}$/.test(fpCode.trim())) {
      setFpError('Please enter the 4-digit code.');
      return;
    }

    setFpLoading(true);
    try {
      await authAPI.verifyCode(fpEmail.trim(), fpCode.trim());
      clearInterval(timerRef.current);
      setFpStep(3);
    } catch (err) {
      setFpError(err.message || 'Incorrect code.');
    } finally {
      setFpLoading(false);
    }
  };

  /* Step 3: Save new password */
  const handleResetPassword = async () => {
    setFpError('');
    if (!fpNewPassword || fpNewPassword.length < VALIDATION.PASSWORD.minLength) {
      setFpError(VALIDATION.PASSWORD.messages.minLength);
      return;
    }

    setFpLoading(true);
    try {
      await authAPI.resetPassword(fpEmail.trim(), fpCode.trim(), fpNewPassword);
      closeForgotPassword();
      setSuccessMsg('Password updated! Please log in with your new password.');
      setEmail(fpEmail.trim());
    } catch (err) {
      setFpError(err.message || 'Unable to reach server.');
    } finally {
      setFpLoading(false);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="auth-page animate-in">
      <div className="auth-card">
        <div className="auth-header">
          <h1 id="login-heading">Welcome back</h1>
          <p>Sign in to your KanBoards account</p>
        </div>

        {successMsg && <div className="alert-success-pill">{successMsg}</div>}

        <form onSubmit={handleLogin} className="auth-form" id="login-form">
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className={`input ${error && !email ? 'input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              className={error && !password ? 'input-error' : ''}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your password"
            />
            {error && <span className="field-error">{error}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading} id="login-submit">
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" className="btn-link" onClick={openForgotPassword} id="forgot-password-btn">
            Forgot password?
          </button>
          <div className="auth-switch">
            Don't have an account? <Link to="/register">Create one</Link>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ───────────────────────────── */}
      <Modal
        isOpen={fpOpen}
        onClose={closeForgotPassword}
        title={fpStep === 1 ? 'Forgot Password' : fpStep === 2 ? 'Enter Code' : 'New Password'}
        className="forgot-modal"
      >

        {fpStep === 1 && (
          <div className="fp-step">
            <p className="fp-instruction" style={{ marginBottom: 20, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Enter your email and we'll send a 4-digit code.
            </p>
            <div className="form-group">
              <label htmlFor="fp-email">Email</label>
              <input
                id="fp-email"
                type="email"
                className={`input ${fpError ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={fpEmail}
                onChange={(e) => { setFpEmail(e.target.value); setFpError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                autoFocus
              />
              {fpError && <span className="field-error">{fpError}</span>}
            </div>
            <div className="modal-footer" style={{ marginTop: 24, padding: 0 }}>
              <button className="btn btn-ghost" onClick={closeForgotPassword} type="button">Cancel</button>
              <button className="btn btn-primary" onClick={handleSendCode} disabled={fpLoading} type="button">
                {fpLoading ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          </div>
        )}

        {fpStep === 2 && (
          <div className="fp-step">
            <p className="fp-instruction" style={{ marginBottom: 20, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Code sent to <strong>{fpEmail}</strong>
            </p>
            <div className="form-group">
              <label htmlFor="fp-code">4-digit code</label>
              <input
                id="fp-code"
                type="text"
                className={`input ${fpError ? 'input-error' : ''}`}
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px' }}
                placeholder="0000"
                maxLength={4}
                value={fpCode}
                onChange={(e) => { setFpCode(e.target.value.replace(/\D/g, '')); setFpError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                autoFocus
              />
              {fpError && <span className="field-error">{fpError}</span>}
            </div>
            <div className="fp-timer" style={{ marginTop: 12, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {fpTimer > 0
                ? `Resend available in ${fpTimer}s`
                : (
                  <button className="btn-link" onClick={handleResend} disabled={fpLoading} type="button">
                    Resend code
                  </button>
                )}
            </div>
            <div className="modal-footer" style={{ marginTop: 24, padding: 0 }}>
              <button className="btn btn-ghost" onClick={() => setFpStep(1)} type="button">Back</button>
              <button className="btn btn-primary" onClick={handleVerifyCode} disabled={fpLoading} type="button">
                {fpLoading ? 'Verifying…' : 'Verify Code'}
              </button>
            </div>
          </div>
        )}

        {fpStep === 3 && (
          <div className="fp-step">
            <p className="fp-instruction" style={{ marginBottom: 20, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Enter your new password.
            </p>
            <div className="form-group">
              <label htmlFor="fp-new-password">New password</label>
              <PasswordInput
                id="fp-new-password"
                className={fpError ? 'input-error' : ''}
                value={fpNewPassword}
                onChange={(e) => { setFpNewPassword(e.target.value); setFpError(''); }}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              {fpError && <span className="field-error">{fpError}</span>}
            </div>
            <div className="modal-footer" style={{ marginTop: 24, padding: 0 }}>
              <button className="btn btn-ghost" onClick={() => setFpStep(2)} type="button">Back</button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={fpLoading} type="button">
                {fpLoading ? 'Saving…' : 'Reset Password'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
