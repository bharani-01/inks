import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Gate for the Printer Admin zone (/printer/*).
 * Only PRINTER_ADMIN users are allowed through.
 * Full ADMINs are redirected to their own /admin zone.
 * Regular users are sent to the user app.
 */
export default function RequirePrinterAdmin({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user?.role === 'ADMIN') {
    // Full admins should use the /admin zone
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user?.role !== 'PRINTER_ADMIN') {
    return <Navigate to="/user/print" replace />;
  }

  return children;
}
