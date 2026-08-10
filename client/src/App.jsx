import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { dashboardPath } from './lib/api.js';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Track from './pages/Track.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import UserLayout from './components/user/UserLayout.jsx';
import Print from './pages/user/Print.jsx';
import Orders from './pages/user/Orders.jsx';
import Documents from './pages/user/Documents.jsx';
import Support from './pages/user/Support.jsx';
import Profile from './pages/user/Profile.jsx';

/** Auth pages redirect to the role dashboard when already signed in. */
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    const target = dashboardPath(user);
    if (target.startsWith('/admin')) {
      window.location.href = target;
      return null;
    }
    return <Navigate to={target} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* Public order tracking — no login required (shareable link). */}
      <Route path="/track" element={<Track />} />
      <Route path="/track/:orderNumber" element={<Track />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <Register />
          </RedirectIfAuthed>
        }
      />

      <Route
        path="/user"
        element={
          <RequireAuth>
            <UserLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/user/print" replace />} />
        <Route path="print" element={<Print />} />
        <Route path="quickprint" element={<Navigate to="/user/print" replace />} />
        <Route path="orders" element={<Orders />} />
        <Route path="documents" element={<Documents />} />
        <Route path="support" element={<Support />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/user/print" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
