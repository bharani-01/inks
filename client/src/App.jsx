import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { dashboardPath } from './lib/api.js';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Track from './pages/Track.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import UserLayout from './components/user/UserLayout.jsx';
import Print from './pages/user/Print.jsx';
import PayOrder from './pages/user/PayOrder.jsx';
import Orders from './pages/user/Orders.jsx';
import Documents from './pages/user/Documents.jsx';
import Support from './pages/user/Support.jsx';
import Profile from './pages/user/Profile.jsx';

import RequireAdmin from './components/RequireAdmin.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminOrders from './pages/admin/Orders.jsx';
import AdminPayments from './pages/admin/Payments.jsx';
import AdminDocuments from './pages/admin/Documents.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminCoupons from './pages/admin/Coupons.jsx';
import AdminPricing from './pages/admin/Pricing.jsx';

/** Auth pages redirect to the role dashboard when already signed in. */
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    const target = dashboardPath(user);
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
        path="/forgot-password"
        element={
          <RedirectIfAuthed>
            <ForgotPassword />
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
        <Route path="pay/:orderId" element={<PayOrder />} />
        <Route path="orders" element={<Orders />} />
        <Route path="documents" element={<Documents />} />
        <Route path="support" element={<Support />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/user/print" replace />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
