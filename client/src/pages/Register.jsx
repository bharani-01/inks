import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { isValidEmail } from '../lib/format.js';
import { useToast } from '../components/Toaster.jsx';
import AuthShell, { AuthFooterLink } from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/Button.jsx';
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react';

const EMPTY = { name: '', email: '', phone: '', password: '', confirmPassword: '' };

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [registeredPending, setRegisteredPending] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validateField(key, value) {
    switch (key) {
      case 'name':
        return value.trim() ? '' : 'Name is required';
      case 'email':
        if (!value.trim()) return 'Email is required';
        return isValidEmail(value.trim()) ? '' : 'Enter a valid email address';
      case 'password':
        if (value && value.length < 6) return 'Password must be at least 6 characters';
        return '';
      case 'confirmPassword':
        if (value && value !== form.password) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  }

  const onBlur = (key) => (e) => {
    const msg = validateField(key, e.target.value);
    setErrors((prev) => ({ ...prev, [key]: msg || undefined }));
  };

  function validateAll(currentForm = form) {
    const next = {};
    if (!currentForm.name.trim()) next.name = 'Name is required';
    if (!currentForm.email.trim()) next.email = 'Email is required';
    else if (!isValidEmail(currentForm.email.trim())) next.email = 'Enter a valid email address';
    if (!currentForm.password) next.password = 'Password is required';
    else if (currentForm.password.length < 6) next.password = 'Password must be at least 6 characters';
    if (currentForm.password !== currentForm.confirmPassword) next.confirmPassword = 'Passwords do not match';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const currentForm = {
      name: (formEl.elements.name?.value ?? form.name).trim(),
      email: (formEl.elements.email?.value ?? form.email).trim(),
      phone: (formEl.elements.phone?.value ?? form.phone).trim(),
      password: formEl.elements.password?.value ?? form.password,
      confirmPassword: formEl.elements.confirmPassword?.value ?? form.confirmPassword,
    };

    setForm((prev) => ({ ...prev, ...currentForm }));

    const next = validateAll(currentForm);
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        name: currentForm.name,
        email: currentForm.email,
        phone: currentForm.phone,
        password: currentForm.password,
      });

      if (data.pendingApproval) {
        setRegisteredPending(true);
        toast('Account created! Pending admin approval.', 'success');
      } else {
        toast('Account created successfully!', 'success');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 500);
      }
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('email already')) {
        setErrors((prev) => ({ ...prev, email: err.message }));
      }
      toast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (registeredPending) {
    return (
      <AuthShell
        title="Registration Received!"
        subtitle="Your account has been created and is pending administrator approval."
        footer={<AuthFooterLink prompt="Ready to log in?" to="/login" label="Go to Sign in" />}
      >
        <div className="text-center py-4 space-y-5">
          <div className="h-16 w-16 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center ring-8 ring-amber-50">
            <Clock size={32} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold font-display text-ink">Awaiting Admin Approval</h3>
            <p className="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
              We have received your registration for <strong className="text-ink">{form.email}</strong>. For security, an administrator will review and activate your account shortly.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-paper-sunken border border-line text-xs text-ink-muted text-left space-y-1.5">
            <div className="flex items-center gap-2 text-ink font-semibold">
              <CheckCircle2 size={15} className="text-green-600" /> What happens next?
            </div>
            <p>1. The admin receives your account request.</p>
            <p>2. Once approved, you can immediately log in with your password.</p>
          </div>

          <div className="pt-2">
            <Link to="/login" className="btn btn-primary btn-block justify-center">
              Go to Sign in <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start printing in minutes — no queue required."
      footer={<AuthFooterLink prompt="Already have an account?" to="/login" label="Sign in" />}
    >
      <form onSubmit={handleSubmit} method="post" action="#" name="register" noValidate className="space-y-4">
        <Field
          label="Full name"
          name="name"
          id="name"
          autoComplete="name"
          placeholder="Priya Sharma"
          value={form.name}
          onChange={set('name')}
          onBlur={onBlur('name')}
          error={errors.name}
        />
        <Field
          label="Email"
          type="email"
          name="email"
          id="email"
          autoComplete="username email"
          placeholder="you@college.edu"
          value={form.email}
          onChange={set('email')}
          onBlur={onBlur('email')}
          error={errors.email}
        />
        <Field
          label="Phone"
          type="tel"
          name="phone"
          id="phone"
          autoComplete="tel"
          optional
          placeholder="Optional"
          value={form.phone}
          onChange={set('phone')}
        />
        <PasswordField
          label="Password"
          name="password"
          id="password"
          autoComplete="new-password"
          placeholder="Minimum 6 characters"
          value={form.password}
          onChange={set('password')}
          onBlur={onBlur('password')}
          error={errors.password}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          onBlur={onBlur('confirmPassword')}
          error={errors.confirmPassword}
        />
        <Button type="submit" block size="lg" loading={loading} loadingText="Creating account…">
          Create Account
        </Button>
      </form>
    </AuthShell>
  );
}
