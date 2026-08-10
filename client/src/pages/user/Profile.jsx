import { useEffect, useState } from 'react';
import {
  User,
  ShieldCheck,
  Package,
  DollarSign,
  Printer,
  FileText,
  Clock,
  Calendar,
  Lock,
  Download,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { api, previewUrl } from '../../lib/api.js';
import { isValidEmail, formatDate, formatDateTime, formatMoney, formatFileSize, initials } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader } from '../../components/States.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import Field from '../../components/Field.jsx';
import PasswordField from '../../components/PasswordField.jsx';
import Button from '../../components/Button.jsx';
import { Link } from 'react-router-dom';

const EMPTY_PW = { currentPassword: '', newPassword: '', confirmNewPassword: '' };

const STATUS_COLORS = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-orange-100 text-orange-700',
  PRINTED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState(EMPTY_PW);
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get('/users/profile');
        if (!active) return;
        setProfile(data.user);
        setStats(data.stats || null);
        setRecentOrders(data.recentOrders || []);
        setRecentDocuments(data.recentDocuments || []);
        setForm({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
        });
        updateUser(data.user);
      } catch {
        toast('Failed to load profile details', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setPwField = (key) => (e) => setPw((p) => ({ ...p, [key]: e.target.value }));

  async function handleProfileSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!isValidEmail(form.email.trim())) next.email = 'Enter a valid email address';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSavingProfile(true);
    try {
      const data = await api.put('/users/profile', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setProfile(data.user);
      updateUser(data.user);
      toast('Profile updated successfully', 'success');
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const currentPassword = formEl.elements.currentPassword?.value ?? pw.currentPassword;
    const newPassword = formEl.elements.newPassword?.value ?? pw.newPassword;
    const confirmNewPassword = formEl.elements.confirmNewPassword?.value ?? pw.confirmNewPassword;

    const next = {};
    if (!currentPassword) next.currentPassword = 'Current password is required';
    if (!newPassword) next.newPassword = 'New password is required';
    else if (newPassword.length < 6) next.newPassword = 'Must be at least 6 characters';
    if (newPassword !== confirmNewPassword) next.confirmNewPassword = 'Passwords do not match';
    setPwErrors(next);
    if (Object.keys(next).length) return;

    setSavingPw(true);
    try {
      await api.put('/users/change-password', {
        currentPassword,
        newPassword,
      });
      toast('Password changed successfully', 'success');
      setPw(EMPTY_PW);
      setPwErrors({});
    } catch (err) {
      toast(err.message || 'Password change failed', 'error');
    } finally {
      setSavingPw(false);
    }
  }

  if (loading) return <PageLoader label="Loading your profile…" />;

  const display = profile || user || {};
  const isAdmin = display.role === 'ADMIN';

  return (
    <div className="max-w-content mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">
          {isAdmin ? 'Admin Profile & Activity' : 'Account Profile & History'}
        </h1>
        <p className="text-ink-muted mt-1">
          Manage your account credentials, view lifetime print volume, and check activity history.
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-muted">Total Orders</p>
            <p className="text-2xl font-bold font-display text-ink mt-0.5">{stats?.ordersCount || 0}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-muted">Total Spent</p>
            <p className="text-2xl font-bold font-display text-ink mt-0.5">{formatMoney(stats?.totalSpent || 0)}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <Printer size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-muted">Pages Printed</p>
            <p className="text-2xl font-bold font-display text-ink mt-0.5">{stats?.totalPagesPrinted || 0}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-muted">Uploaded Files</p>
            <p className="text-2xl font-bold font-display text-ink mt-0.5">{stats?.documentsCount || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* User Identity & Info Sidebar */}
        <div className="card p-6 text-center lg:sticky lg:top-24 space-y-4">
          <div className="h-20 w-20 mx-auto rounded-full bg-accent text-white inline-flex items-center justify-center font-display font-bold text-3xl shadow-sm ring-4 ring-accent-soft">
            {initials(display.name)}
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-ink break-words">{display.name}</h2>
            <p className="text-sm text-ink-muted break-words mt-0.5">{display.email}</p>
          </div>

          <div className="pt-2 border-t border-line space-y-2.5 text-xs text-left">
            <div className="flex items-center justify-between py-1">
              <span className="text-ink-muted">Account Role</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {isAdmin ? 'Administrator' : 'User / Student'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-ink-muted">Account Status</span>
              <span className="text-green-700 font-semibold flex items-center gap-1">
                ● Active
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-ink-muted">Member Since</span>
              <span className="text-ink font-medium">
                {formatDate(display.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Account Edit & Password Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Form */}
          <form onSubmit={handleProfileSubmit} noValidate className="card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <User size={18} className="text-accent" />
              <h3 className="font-display font-semibold text-ink">Account Credentials</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Full name"
                name="name"
                id="profile-name"
                autoComplete="name"
                value={form.name}
                onChange={setField('name')}
                error={errors.name}
              />
              <Field
                label="Email address"
                type="email"
                name="email"
                id="profile-email"
                autoComplete="username email"
                value={form.email}
                onChange={setField('email')}
                error={errors.email}
              />
            </div>
            <Field
              label="Phone number (optional)"
              type="tel"
              name="phone"
              id="profile-phone"
              autoComplete="tel"
              optional
              value={form.phone}
              onChange={setField('phone')}
              placeholder="+91 98765 43210"
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={savingProfile} loadingText="Saving…">
                Save Profile Changes
              </Button>
            </div>
          </form>

          {/* Change Password Form */}
          <form
            onSubmit={handlePasswordSubmit}
            method="post"
            action="#"
            name="change-password"
            noValidate
            className="card p-6 space-y-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <Lock size={18} className="text-accent" />
              <h3 className="font-display font-semibold text-ink">Security &amp; Password</h3>
            </div>
            <PasswordField
              label="Current Password"
              name="currentPassword"
              id="currentPassword"
              autoComplete="current-password"
              value={pw.currentPassword}
              onChange={setPwField('currentPassword')}
              error={pwErrors.currentPassword}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordField
                label="New Password"
                name="newPassword"
                id="newPassword"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={setPwField('newPassword')}
                error={pwErrors.newPassword}
              />
              <PasswordField
                label="Confirm New Password"
                name="confirmNewPassword"
                id="confirmNewPassword"
                autoComplete="new-password"
                value={pw.confirmNewPassword}
                onChange={setPwField('confirmNewPassword')}
                error={pwErrors.confirmNewPassword}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" variant="secondary" loading={savingPw} loadingText="Updating…">
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* History Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders History */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <h3 className="font-display font-semibold text-ink flex items-center gap-2">
              <Clock size={18} className="text-accent" /> Recent Print Jobs
            </h3>
            <Link
              to={isAdmin ? '/admin/orders' : '/user/orders'}
              className="text-xs text-accent hover:underline inline-flex items-center gap-0.5"
            >
              View all orders <ChevronRight size={13} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="text-sm text-ink-muted py-6 text-center">No print orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((o) => (
                <li key={o.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <FileTypeIcon mimeType={o.document?.mimeType} size={18} boxed />
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-ink truncate">{o.orderNumber}</p>
                      <p className="text-ink-muted truncate max-w-[180px]">{o.document?.originalName || 'Document'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-bold text-ink">{formatMoney(o.totalAmount)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[o.orderStatus] || 'bg-paper-hover text-ink'}`}>
                      {o.orderStatus}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Uploaded Documents */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <h3 className="font-display font-semibold text-ink flex items-center gap-2">
              <FileText size={18} className="text-accent" /> Recent Uploaded Files
            </h3>
            <Link
              to={isAdmin ? '/admin/documents' : '/user/documents'}
              className="text-xs text-accent hover:underline inline-flex items-center gap-0.5"
            >
              View all files <ChevronRight size={13} />
            </Link>
          </div>

          {recentDocuments.length === 0 ? (
            <p className="text-sm text-ink-muted py-6 text-center">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentDocuments.map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <FileTypeIcon mimeType={d.mimeType} size={18} boxed />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate max-w-[200px]" title={d.originalName}>
                        {d.originalName}
                      </p>
                      <p className="text-ink-muted">
                        {formatFileSize(d.fileSize)} · {formatDate(d.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={previewUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover"
                      title="Preview"
                    >
                      <ExternalLink size={15} />
                    </a>
                    <a
                      href={previewUrl(d.id, { download: true })}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover"
                      title="Download"
                      download
                    >
                      <Download size={15} />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
