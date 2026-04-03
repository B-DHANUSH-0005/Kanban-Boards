/**
 * ToastContext.jsx — Unified notifications: toasts, success ticks, confirm dialogs.
 * One context instead of three keeps the provider tree shallow.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  /* ── Toast ────────────────────────────────────────────────── */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, isError = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, isError });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Success tick ─────────────────────────────────────────── */
  const [success, setSuccess] = useState(null);
  const successTimer = useRef(null);

  const showSuccess = useCallback((message = 'Done') => {
    clearTimeout(successTimer.current);
    setSuccess(message);
    successTimer.current = setTimeout(() => setSuccess(null), 1800);
  }, []);

  /* ── Confirm dialog ───────────────────────────────────────── */
  const [confirm, setConfirm] = useState(null);
  const confirmResolve = useRef(null);

  const showConfirm = useCallback((title, message, okText = 'Delete') => {
    return new Promise((resolve) => {
      confirmResolve.current = resolve;
      setConfirm({ title, message, okText });
    });
  }, []);

  const handleConfirm = useCallback((result) => {
    confirmResolve.current?.(result);
    setConfirm(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showConfirm }}>
      {children}

      {/* Toast notification */}
      <div className={`toast ${toast ? 'show' : ''} ${toast?.isError ? 'error' : ''}`}>
        {toast?.message}
      </div>

      {/* Success overlay */}
      {success && (
        <div className="success-overlay active">
          <div className="success-content">
            <svg className="tick-svg" viewBox="0 0 52 52">
              <circle className="tick-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="tick-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
            <p className="success-msg">{success}</p>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay active" onClick={() => handleConfirm(false)}>
          <div className="modal-content confirm-box-max" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{confirm.title}</h3>
              <button className="modal-close-btn" onClick={() => handleConfirm(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {confirm.message && <p className="confirm-text">{confirm.message}</p>}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => handleConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirm.okText === 'Delete' ? 'btn-primary' : 'btn-primary'}`}
                style={confirm.okText === 'Delete' ? { background: '#d00000', borderColor: '#d00000' } : {}}
                onClick={() => handleConfirm(true)}
              >
                {confirm.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
