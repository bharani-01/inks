import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, dashboardPath } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toaster.jsx';
import AuthShell, { AuthFooterLink } from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import Button from '../components/Button.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
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
      }, 400);
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to upload documents and track your prints."
      footer={<AuthFooterLink prompt="New here?" to="/register" label="Create an account" />}
    >
      <form onSubmit={handleSubmit} method="post" action="#" name="login" noValidate className="space-y-4">
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
        />
        <PasswordField
          label="Password"
          name="password"
          id="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" block size="lg" loading={loading} loadingText="Signing in…">
          Sign In
        </Button>
      </form>
    </AuthShell>
  );
}
