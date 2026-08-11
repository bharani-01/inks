import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { dashboardPath } from './lib/api.js';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Track from './pages/Track.jsx';
import Scan from './pages/Scan.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import UserLayout from './components/user/UserLayout.jsx';
import Print from './pages/user/Print.jsx';
import PayOrder from './pages/user/PayOrder.jsx';
import Orders from './pages/user/Orders.jsx';
import Documents from './pages/user/Documents.jsx';
import Support from './pages/user/Support.jsx';
import Profile from './pages/user/Profile.jsx';
import UserWallet from './pages/user/Wallet.jsx';

import RequireAdmin from './components/RequireAdmin.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminOrders from './pages/admin/Orders.jsx';
import AdminPayments from './pages/admin/Payments.jsx';
import AdminDocuments from './pages/admin/Documents.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminCoupons from './pages/admin/Coupons.jsx';
import AdminPricing from './pages/admin/Pricing.jsx';
import AdminFeedback from './pages/admin/Feedback.jsx';
import AdminWallet from './pages/admin/Wallet.jsx';

import RequirePrinterAdmin from './components/RequirePrinterAdmin.jsx';
import PrinterLayout from './components/printer/PrinterLayout.jsx';

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
      {/* QR code scan page — public */}
      <Route path="/scan/:token" element={<Scan />} />
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
        <Route path="wallet" element={<UserWallet />} />
        <Route path="support" element={<Support />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/user/print" replace />} />
      </Route>

      {/* Printer Admin zone — stripped layout with orders/payments/documents only */}
      <Route
        path="/printer"
        element={
          <RequirePrinterAdmin>
            <PrinterLayout />
          </RequirePrinterAdmin>
        }
      >
        <Route index element={<Navigate to="/printer/orders" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/printer/orders" replace />} />
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
        <Route path="wallet" element={<AdminWallet />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
