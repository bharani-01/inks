import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { isValidEmail } from '../lib/format.js';
import { useToast } from '../components/Toaster.jsx';
import AuthShell, { AuthFooterLink } from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/Button.jsx';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1 = Enter Email, 2 = Enter Code & New Password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);

  const toast = useToast();
  const navigate = useNavigate();

  // Step 1: Send Reset Code
  async function handleSendCode(e) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return setErrors({ email: 'Email address is required' });
    }
    if (!isValidEmail(cleanEmail)) {
      return setErrors({ email: 'Please enter a valid email address' });
    }
    setErrors({});
    setLoading(true);

    try {
      const data = await api.post('/auth/forgot-password', { email: cleanEmail });
      toast(data.message || 'Verification code sent', 'success');
      setStep(2);
    } catch (err) {
      toast(err.message || 'Failed to send reset code', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Resend Code
  async function handleResendCode() {
    setResending(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      toast('A new verification code has been sent.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to resend code', 'error');
    } finally {
      setResending(false);
    }
  }

  // Step 2: Reset Password
  async function handleResetPassword(e) {
    e.preventDefault();
    const next = {};
    if (!code.trim()) next.code = '6-digit code is required';
    else if (code.trim().length !== 6) next.code = 'Code must be 6 digits';

    if (!newPassword) next.newPassword = 'New password is required';
    else if (newPassword.length < 6) next.newPassword = 'Password must be at least 6 characters';

    if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match';

    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const data = await api.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setSuccess(true);
      toast(data.message || 'Password reset successful!', 'success');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      toast(err.message || 'Password reset failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthShell
        title="Password Reset!"
        subtitle="Your password has been updated successfully."
        footer={<AuthFooterLink prompt="Ready to log in?" to="/login" label="Go to Sign in" />}
      >
        <div className="text-center py-6 space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center ring-8 ring-green-50">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-ink">All Set!</h3>
            <p className="text-sm text-ink-muted mt-1">Redirecting you to the sign in page…</p>
          </div>
          <div className="pt-2">
            <Link to="/login" className="btn btn-primary btn-block justify-center">
              Sign In with New Password
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={step === 1 ? 'Forgot password?' : 'Set new password'}
      subtitle={
        step === 1
          ? 'Enter your registered email address and we will send you a 6-digit recovery code.'
          : `Enter the 6-digit code sent to ${email} and choose your new password.`
      }
      footer={
        <div className="text-center text-xs text-ink-muted">
          Remember your password?{' '}
          <Link to="/login" className="text-accent font-semibold hover:underline">
            Back to Sign in
          </Link>
        </div>
      }
    >
      {step === 1 ? (
        <form onSubmit={handleSendCode} noValidate className="space-y-4">
          <Field
            label="Registered Email"
            type="email"
            name="email"
            id="forgot-email"
            autoComplete="email"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />

          <Button type="submit" block size="lg" loading={loading} loadingText="Sending code…">
            Send Recovery Code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              6-Digit Recovery Code
            </label>
            <input
              type="text"
              name="otp-code"
              id="otp-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`field-input text-center text-xl font-mono tracking-widest font-bold ${
                errors.code ? 'is-error' : ''
              }`}
            />
            {errors.code && <p className="mt-1 text-xs text-danger">{errors.code}</p>}
          </div>

          <PasswordField
            label="New Password"
            name="newPassword"
            id="newPassword"
            autoComplete="new-password"
            placeholder="Minimum 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.newPassword}
            required
          />

          <PasswordField
            label="Confirm New Password"
            name="confirmPassword"
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            required
          />

          <Button type="submit" block size="lg" loading={loading} loadingText="Resetting…">
            Reset Password
          </Button>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-ink-muted hover:text-ink inline-flex items-center gap-1"
            >
              <ArrowLeft size={13} /> Change email
            </button>
            <button
              type="button"
              disabled={resending}
              onClick={handleResendCode}
              className="text-accent font-semibold hover:underline disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
