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
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not configured in .env');
      return;
    }

    let isMounted = true;

    function renderGoogleButton() {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Clear previous render
        googleBtnRef.current.innerHTML = '';

        // Render official Google button with crisp pill shape
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'continue_with',
          width: 320,
          shape: 'pill',
          logo_alignment: 'left',
        });

        if (isMounted) setGoogleReady(true);

        // One-Tap prompt
        window.google.accounts.id.prompt();
      } catch (e) {
        console.warn('Google Identity initialization notice:', e.message);
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

    return () => {
      isMounted = false;
    };
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

  // If no clientId in environment, do not render Google button
  if (!clientId) {
    return null;
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center min-h-[44px] ${className}`}>
      {loading ? (
        <div className="w-full h-11 rounded-full border border-line bg-white flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-ink-muted shadow-2xs">
          <span className="spinner text-teal-600" /> Signing in with Google...
        </div>
      ) : (
        <div className="w-full flex justify-center items-center">
          {/* Official Google Sign-In button container */}
          <div ref={googleBtnRef} className="flex justify-center w-full min-h-[40px]" />
        </div>
      )}
    </div>
  );
}
