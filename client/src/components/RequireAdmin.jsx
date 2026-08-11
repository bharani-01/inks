import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Gate for the admin zone. Redirects unauthenticated users to /login (preserving
 * the intended destination), and bounces USERs to the user app.
 */
export default function RequireAdmin({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user?.role === 'PRINTER_ADMIN') {
    return <Navigate to="/printer/orders" replace />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/user/print" replace />;
  }

  return children;
}
