import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api, dashboardPath } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toaster.jsx';
import { isValidEmail } from '../lib/format.js';
import AuthShell, { AuthFooterLink } from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/Button.jsx';
import { KeyRound, Mail, ArrowLeft, Clock } from 'lucide-react';

export default function Login() {
  const [method, setMethod] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(null);

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle Standard Password Login
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPendingNotice(null);
    const formEl = e.currentTarget;
    const formEmail = (formEl.elements.email?.value ?? email).trim();
    const formPassword = formEl.elements.password?.value ?? password;

    if (formEmail !== email) setEmail(formEmail);
    if (formPassword !== password) setPassword(formPassword);

    const next = {};
    if (!formEmail) next.email = 'Email is required';
    if (!formPassword) next.password = 'Password is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email: formEmail, password: formPassword });
      login(data.token, data.user);
      toast('Welcome back!', 'success');
      const target = dashboardPath(data.user);
      setTimeout(() => {
        navigate(location.state?.from || target, { replace: true });
      }, 350);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('pending') || err.message.toLowerCase().includes('approval'))) {
        setPendingNotice(err.message);
      } else {
        toast(err.message || 'Login failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle Send OTP
  async function handleSendOtp(e) {
    e.preventDefault();
    setPendingNotice(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return setErrors({ email: 'Email is required' });
    }
    if (!isValidEmail(cleanEmail)) {
      return setErrors({ email: 'Enter a valid email address' });
    }
    setErrors({});
    setLoading(true);

    try {
      const data = await api.post('/auth/send-otp', { email: cleanEmail });
      setOtpSent(true);
      toast(data.message || 'Verification code sent!', 'success');
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('pending') || err.message.toLowerCase().includes('approval'))) {
        setPendingNotice(err.message);
      } else {
        toast(err.message || 'Failed to send OTP code', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle Verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setPendingNotice(null);
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      return setErrors({ otpCode: 'Please enter the 6-digit code' });
    }
    setErrors({});
    setLoading(true);

    try {
      const data = await api.post('/auth/verify-otp', {
        email: email.trim(),
        code: otpCode.trim(),
      });
      login(data.token, data.user);
      toast('Signed in successfully!', 'success');
      const target = dashboardPath(data.user);
      setTimeout(() => {
        navigate(location.state?.from || target, { replace: true });
      }, 350);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('pending') || err.message.toLowerCase().includes('approval'))) {
        setPendingNotice(err.message);
      } else {
        toast(err.message || 'Invalid or expired OTP', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    setResending(true);
    try {
      await api.post('/auth/send-otp', { email: email.trim() });
      toast('A new code has been sent to your email.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to resend code', 'error');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to upload documents, configure prints, and track orders."
      footer={<AuthFooterLink prompt="New to Printa?" to="/register" label="Create an account" />}
    >
      {/* Pending Approval Notice */}
      {pendingNotice && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <Clock size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Account Pending Administrator Approval</p>
            <p className="mt-0.5 text-amber-800">{pendingNotice}</p>
          </div>
        </div>
      )}

      {/* Method Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-paper-sunken rounded-xl mb-5 border border-line">
        <button
          type="button"
          onClick={() => {
            setMethod('password');
            setOtpSent(false);
            setErrors({});
          }}
          className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            method === 'password' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <KeyRound size={14} /> Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod('otp');
            setErrors({});
          }}
          className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            method === 'otp' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Mail size={14} /> Email OTP
        </button>
      </div>

      {method === 'password' ? (
        /* Password Form */
        <form onSubmit={handlePasswordSubmit} method="post" action="#" name="login" noValidate className="space-y-4">
          <Field
            label="Email"
            type="email"
            name="email"
            id="email"
            autoComplete="username email"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="field-label !mb-0">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-accent font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordField
              name="password"
              id="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
            />
          </div>

          <Button type="submit" block size="lg" loading={loading} loadingText="Signing in…">
            Sign In with Password
          </Button>
        </form>
      ) : (
        /* OTP Form */
        <div className="space-y-4">
          {!otpSent ? (
            <form onSubmit={handleSendOtp} noValidate className="space-y-4">
              <Field
                label="Registered Email"
                type="email"
                name="email"
                id="otp-email"
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
                hint="We will send a 6-digit one-time passcode to this email."
              />

              <Button type="submit" block size="lg" loading={loading} loadingText="Sending code…">
                Send Sign-In Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-4">
              <div className="text-center p-3 rounded-xl bg-paper-sunken border border-line text-xs">
                <span className="text-ink-muted">Code sent to:</span>{' '}
                <strong className="text-ink">{email}</strong>
              </div>

              <div>
                <label htmlFor="otp-code" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  name="otp-code"
                  id="otp-code"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className={`field-input text-center text-xl font-mono tracking-widest font-bold ${
                    errors.otpCode ? 'is-error' : ''
                  }`}
                  autoFocus
                />
                {errors.otpCode && <p className="mt-1 text-xs text-danger">{errors.otpCode}</p>}
              </div>

              <Button type="submit" block size="lg" loading={loading} loadingText="Verifying…">
                Verify &amp; Sign In
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-ink-muted hover:text-ink inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} /> Change email
                </button>
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendOtp}
                  className="text-accent font-semibold hover:underline disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </AuthShell>
  );
}
