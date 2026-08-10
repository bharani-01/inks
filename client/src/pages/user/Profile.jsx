import { useEffect, useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api.js';
import { isValidEmail, formatDate, initials } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader } from '../../components/States.jsx';
import Field from '../../components/Field.jsx';
import PasswordField from '../../components/PasswordField.jsx';
import Button from '../../components/Button.jsx';

const EMPTY_PW = { currentPassword: '', newPassword: '', confirmNewPassword: '' };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
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
        setForm({ name: data.user.name || '', email: data.user.email || '', phone: data.user.phone || '' });
        updateUser(data.user);
      } catch {
        toast('Failed to load your profile', 'error');
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
      updateUser(data.user); // refreshes the sidebar name + avatar
      toast('Profile updated', 'success');
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
      toast('Password changed', 'success');
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

  return (
    <div className="max-w-content mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">Profile & settings</h1>
        <p className="text-ink-muted mt-1">Manage your account details and password.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Identity card */}
        <div className="card p-6 text-center lg:sticky lg:top-24">
          <div className="h-20 w-20 mx-auto rounded-full bg-accent text-white inline-flex items-center justify-center font-display font-bold text-3xl">
            {initials(display.name)}
          </div>
          <h2 className="mt-4 font-display font-semibold text-lg text-ink break-words">{display.name}</h2>
          <p className="text-sm text-ink-muted break-words">{display.email}</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <span className="inline-flex items-center justify-center gap-1.5 text-ink-soft">
              <ShieldCheck size={15} className="text-accent" /> {display.role === 'ADMIN' ? 'Administrator' : 'Student'}
            </span>
            {display.createdAt && (
              <span className="text-ink-muted">Joined {formatDate(display.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Account details */}
          <form onSubmit={handleProfileSubmit} noValidate className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <User size={18} className="text-accent" />
              <h3 className="font-display font-semibold">Account details</h3>
            </div>
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
              label="Email"
              type="email"
              name="email"
              id="profile-email"
              autoComplete="username email"
              value={form.email}
              onChange={setField('email')}
              error={errors.email}
            />
            <Field
              label="Phone"
              type="tel"
              name="phone"
              id="profile-phone"
              autoComplete="tel"
              optional
              value={form.phone}
              onChange={setField('phone')}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile} loadingText="Saving…">
                Save changes
              </Button>
            </div>
          </form>

          {/* Change password */}
          <form onSubmit={handlePasswordSubmit} method="post" action="#" name="change-password" noValidate className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-accent" />
              <h3 className="font-display font-semibold">Change password</h3>
            </div>
            <PasswordField
              label="Current password"
              name="currentPassword"
              id="currentPassword"
              autoComplete="current-password"
              value={pw.currentPassword}
              onChange={setPwField('currentPassword')}
              error={pwErrors.currentPassword}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordField
                label="New password"
                name="newPassword"
                id="newPassword"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={setPwField('newPassword')}
                error={pwErrors.newPassword}
              />
              <PasswordField
                label="Confirm new password"
                name="confirmNewPassword"
                id="confirmNewPassword"
                autoComplete="new-password"
                value={pw.confirmNewPassword}
                onChange={setPwField('confirmNewPassword')}
                error={pwErrors.confirmNewPassword}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="ink" loading={savingPw} loadingText="Updating…">
                Update password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
