import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, dashboardPath } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toaster.jsx';

// Module-level guard to prevent calling google.accounts.id.initialize multiple times
let initializedClientId = null;

export default function GoogleAuthButton({ label = 'Continue with Google', className = '' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    function renderGoogleButton() {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      try {
        // Initialize Google Identity Services ONCE per client ID
        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: false, // Prevent Chrome FedCM AbortError
          });
          initializedClientId = clientId;
        }

        // Render official GIS button into the overlay ref
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'continue_with',
          width: 380,
          shape: 'pill',
          logo_alignment: 'left',
        });
      } catch (e) {
        console.warn('Google Identity notice:', e.message);
      }
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      document.head.appendChild(script);
    }
  }, [clientId]);

  async function handleCredentialResponse(response) {
    if (!response?.credential) {
      toast('Google authentication did not provide valid credentials', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/google', { credential: response.credential });
      if (data.pendingApproval) {
        toast('Account request submitted! Pending administrator approval.', 'info', 4500);
        navigate('/login', { state: { pendingNotice: data.message } });
        return;
      }

      login(data.token, data.user);
      const firstName = data.user?.name ? data.user.name.split(' ')[0] : 'there';
      toast(`Welcome back, ${firstName}! 👋`, 'success', 3200);
      const target = dashboardPath(data.user);
      setTimeout(() => {
        navigate(location.state?.from || target, { replace: true });
      }, 350);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('pending') || err.message.toLowerCase().includes('approval'))) {
        toast('Account pending administrator approval', 'info', 4500);
        navigate('/login', { state: { pendingNotice: err.message } });
      } else {
        toast(err.message || 'Google sign-in failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleButtonClick() {
    if (!clientId) {
      toast('Google Sign-In requires VITE_GOOGLE_CLIENT_ID in your .env file', 'warning', 4500);
      return;
    }
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.info('Google One-Tap prompt status:', notification.getNotDisplayedReason() || notification.getSkippedReason());
          }
        });
      } catch (err) {
        console.warn('Google prompt notice:', err.message);
      }
    } else {
      toast('Loading Google Sign-In service…', 'info');
    }
  }

  return (
    <div className={`relative w-full ${className}`}>
      {loading ? (
        <div className="w-full h-11 rounded-full border border-line bg-white flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-ink-muted shadow-2xs">
          <span className="spinner text-indigo-600" /> Signing in with Google...
        </div>
      ) : (
        <div className="relative w-full h-11 overflow-hidden rounded-full flex justify-center items-center">
          {/* Visible Styled Google Pill Button */}
          <button
            type="button"
            onClick={handleButtonClick}
            className="w-full h-11 rounded-full border border-line bg-white hover:bg-slate-50 text-ink font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-2xs transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{label}</span>
          </button>

          {/* GIS Overlay Container (when clientId is provided) */}
          {clientId && (
            <div
              ref={googleBtnRef}
              className="absolute inset-0 opacity-0.001 cursor-pointer flex justify-center items-center overflow-hidden scale-125"
              style={{ opacity: 0.001 }}
            />
          )}
        </div>
      )}
    </div>
  );
}
