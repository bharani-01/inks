import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUser,
  getToken,
  setToken as persistToken,
  setUser as persistUser,
  clearAuth,
  setUnauthorizedHandler,
  dashboardPath,
} from '../lib/api.js';
import { identifyUser } from '../lib/clarity.js';
import { useToast } from '../components/Toaster.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => {
    const initialUser = getUser();
    if (initialUser) identifyUser(initialUser);
    return initialUser;
  });
  const navigate = useNavigate();
  const toast = useToast();

  // Centralize 401 handling: clear, warn, and send to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUserState(null);
      if (!window.location.pathname.includes('login')) {
        toast('Session expired. Please login again.', 'warning');
        setTimeout(() => navigate('/login'), 1200);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, toast]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user && !!getToken(),
      login(token, nextUser) {
        persistToken(token);
        persistUser(nextUser);
        setUserState(nextUser);
        identifyUser(nextUser);
      },
      updateUser(nextUser) {
        persistUser(nextUser);
        setUserState(nextUser);
        identifyUser(nextUser);
      },
      logout() {
        clearAuth();
        setUserState(null);
        navigate('/login');
      },
      dashboardPath: () => dashboardPath(user),
    }),
    [user, navigate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
