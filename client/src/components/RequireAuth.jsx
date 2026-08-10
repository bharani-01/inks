import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Gate for the user zone. Redirects unauthenticated users to /login (preserving
 * the intended destination), and bounces ADMINs to the HTML admin app.
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // A shared /user/orders?track=CODE link should show the public tracking page
    // instead of forcing a login on whoever it's shared with.
    const track = new URLSearchParams(location.search).get('track');
    if (track && location.pathname.startsWith('/user/orders')) {
      return <Navigate to={`/track?track=${encodeURIComponent(track)}`} replace />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}
