import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { VALIDATION } from '../constants/config';
import PasswordInput from '../components/PasswordInput';

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!VALIDATION.EMAIL.pattern.test(email.trim())) {
      errors.email = VALIDATION.EMAIL.message;
    }
    if (!password) {
      errors.password = VALIDATION.PASSWORD.messages.required;
    } else if (password.length < VALIDATION.PASSWORD.minLength) {
      errors.password = VALIDATION.PASSWORD.messages.minLength;
    }
    return errors;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await authAPI.register(email.trim(), password);

      navigate(`/login?message=${encodeURIComponent('Account created! You can now log in.')}`, {
        replace: true,
      });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="auth-page animate-in">
      <div className="auth-card">
        <div className="auth-header">
          <h1 id="register-heading">Create Account</h1>
          <p>Get started with KanBoards for free</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form" id="register-form">
          <div className="form-group">
            <label htmlFor="register-email">Email Address</label>
            <input
              id="register-email"
              type="email"
              className={`input ${fieldErrors.email ? 'input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' }));
              }}
              autoComplete="email"
              autoFocus
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="register-password">Password</label>
            <PasswordInput
              id="register-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' }));
                setError('');
              }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className={fieldErrors.password ? 'input-error' : ''}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          {error && <div className="field-error" style={{ marginBottom: 18, textAlign: 'center' }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading} id="register-submit">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <div className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
