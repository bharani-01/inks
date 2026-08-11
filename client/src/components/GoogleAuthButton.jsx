import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, dashboardPath } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toaster.jsx';

export default function GoogleAuthButton({ label = 'Continue with Google', className = '' }) {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    function initGoogle() {
      if (!window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Render official Google Sign-In button inside ref
        if (googleBtnRef.current) {
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
        }

        // Trigger top-right One-Tap prompt on page load
        window.google.accounts.id.prompt();
      } catch (e) {
        console.warn('Google Identity notice:', e.message);
      }
    }

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    }
  }, []);

  async function handleCredentialResponse(response) {
    if (!response?.credential) return;
    setLoading(true);
    try {
      const data = await api.post('/auth/google', { credential: response.credential });
      if (data.pendingApproval) {
        toast(data.message || 'Account created with Google! Pending administrator approval.', 'info', 5000);
        return;
      }
      login(data.token, data.user);
      const firstName = data.user?.name ? data.user.name.split(' ')[0] : 'there';
      toast(`Welcome, ${firstName}! Google Sign-In successful.`, 'success', 3200);
      const target = dashboardPath(data.user);
      navigate(target, { replace: true });
    } catch (err) {
      toast(err.message || 'Google Sign-In failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleCustomButtonClick() {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  }

  return (
    <div className={`relative w-full ${className}`}>
      {loading ? (
        <div className="w-full h-11 rounded-full border border-line bg-white flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-ink-muted shadow-2xs">
          <span className="spinner text-accent" /> Signing in with Google...
        </div>
      ) : (
        <div className="relative w-full h-11 overflow-hidden rounded-full flex justify-center items-center">
          {/* Visual Styled Pill Representation */}
          <button
            type="button"
            className="w-full h-11 rounded-full border border-line bg-white hover:bg-slate-50 text-ink font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-2xs transition-all pointer-events-none"
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

          {/* Official GIS rendered button overlay */}
          <div
            ref={googleBtnRef}
            onClick={handleCustomButtonClick}
            className="absolute inset-0 opacity-0.001 cursor-pointer flex justify-center items-center overflow-hidden scale-150"
            style={{ opacity: 0.001 }}
          />
        </div>
      )}
    </div>
  );
}
