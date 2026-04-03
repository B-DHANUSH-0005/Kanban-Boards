/**
 * AuthContext.jsx — Global auth state.
 * Reads from localStorage on mount so logins persist across refreshes.
 */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem(STORAGE_KEYS.TOKEN) || '',
    username: localStorage.getItem(STORAGE_KEYS.USERNAME) || '',
    userId: localStorage.getItem(STORAGE_KEYS.USER_ID) || '',
  }));

  const isAuthenticated = !!auth.token;

  const login = useCallback((data) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEYS.USERNAME, data.username);
    localStorage.setItem(STORAGE_KEYS.USER_ID, String(data.user_id));
    setAuth({
      token: data.access_token,
      username: data.username,
      userId: String(data.user_id),
    });
  }, []);

  const logout = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    // Also clear any board caches
    Object.keys(localStorage)
      .filter((k) => k.startsWith('kb_'))
      .forEach((k) => localStorage.removeItem(k));
    setAuth({ token: '', username: '', userId: '' });
  }, []);

  const value = useMemo(
    () => ({ ...auth, isAuthenticated, login, logout }),
    [auth, isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
