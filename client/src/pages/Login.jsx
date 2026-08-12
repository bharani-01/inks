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
      const firstName = data.user?.name ? data.user.name.split(' ')[0] : 'there';
      toast(`Welcome back, ${firstName}! 👋`, 'success', 3200);
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

    setLoading(true);
    try {
      await api.post('/auth/send-otp', { email: cleanEmail });
      setOtpSent(true);
      toast('Verification code sent to your email!', 'success');
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

  // Handle Verify OTP & Login
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setPendingNotice(null);
    const cleanEmail = email.trim();
    const cleanCode = otpCode.trim();

    const next = {};
    if (!cleanEmail) next.email = 'Email is required';
    if (!cleanCode) next.otpCode = 'Verification code is required';
    else if (cleanCode.length !== 6) next.otpCode = 'Enter the 6-digit code';

    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const data = await api.post('/auth/verify-otp', { email: cleanEmail, code: cleanCode });
      login(data.token, data.user);
      const firstName = data.user?.name ? data.user.name.split(' ')[0] : 'there';
      toast(`Welcome back, ${firstName}! 👋`, 'success', 3200);
      const target = dashboardPath(data.user);
      setTimeout(() => {
        navigate(location.state?.from || target, { replace: true });
      }, 350);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('pending') || err.message.toLowerCase().includes('approval'))) {
        setPendingNotice(err.message);
      } else {
        toast(err.message || 'Invalid or expired code', 'error');
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
      footer={<AuthFooterLink prompt="New to Inks?" to="/register" label="Create an account" />}
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

      {/* Login Method Switcher Tabs */}
      <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-paper-sunken rounded-xl border border-line">
        <button
          type="button"
          onClick={() => {
            setMethod('password');
            setOtpSent(false);
            setErrors({});
          }}
          className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            method === 'password'
              ? 'bg-white text-ink shadow-xs border border-line'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <KeyRound size={14} className="shrink-0" />
          <span>Password</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMethod('otp');
            setErrors({});
          }}
          className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            method === 'otp'
              ? 'bg-white text-ink shadow-xs border border-line'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Mail size={14} className="shrink-0" />
          <span>Email OTP</span>
        </button>
      </div>

      {/* 1. Password Method Form */}
      {method === 'password' && (
        <form onSubmit={handlePasswordSubmit} method="post" action="#" name="login" noValidate className="space-y-4">
          <Field
            label="Email"
            type="email"
            name="email"
            id="email"
            autoComplete="username email"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={errors.email}
          />
          <PasswordField
            label="Password"
            name="password"
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            hint={
              <Link to="/forgot-password" className="text-xs text-teal-700 font-semibold hover:underline">
                Forgot password?
              </Link>
            }
          />
          <Button type="submit" block size="lg" loading={loading} loadingText="Signing in…">
            Sign In
          </Button>
        </form>
      )}

      {/* 2. Email OTP Method Form */}
      {method === 'otp' && (
        <div className="space-y-4">
          {!otpSent ? (
            <form onSubmit={handleSendOtp} noValidate className="space-y-4">
              <Field
                label="Email address"
                type="email"
                name="email"
                id="otpEmail"
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={errors.email}
                hint="We'll send a 6-digit verification code to your inbox."
              />
              <Button type="submit" block size="lg" loading={loading} loadingText="Sending code…">
                Send Verification Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-4 animate-fade-in">
              <div className="p-3 bg-paper-sunken rounded-xl border border-line flex items-center justify-between text-xs">
                <span className="text-ink-muted">Code sent to: <strong className="text-ink">{email}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                  }}
                  className="text-teal-700 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} /> Change
                </button>
              </div>

              <Field
                label="6-digit verification code"
                type="text"
                name="otpCode"
                id="otpCode"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpCode(val);
                  if (errors.otpCode) setErrors((prev) => ({ ...prev, otpCode: undefined }));
                }}
                error={errors.otpCode}
                className="text-center font-mono text-lg tracking-widest"
              />

              <Button type="submit" block size="lg" loading={loading} loadingText="Verifying…">
                Verify &amp; Sign In
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-xs text-ink-muted hover:text-teal-700 font-medium transition-colors cursor-pointer"
                >
                  {resending ? 'Sending…' : "Didn't receive the code? Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </AuthShell>
  );
}
