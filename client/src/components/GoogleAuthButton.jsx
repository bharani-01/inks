import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toaster.jsx';

export default function GoogleAuthButton({ label = 'Continue with Google', className = '' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
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

        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'continue_with',
          width: 320,
          shape: 'pill',
          logo_alignment: 'left',
        });

        window.google.accounts.id.prompt();
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
      login(data.token, data.user);
      toast('Signed in with Google successfully!', 'success');
      navigate('/print');
    } catch (err) {
      toast(err.message || 'Google sign-in failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!clientId) {
    return null;
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center min-h-[44px] ${className}`}>
      {loading ? (
        <div className="w-full h-11 rounded-full border border-line bg-white flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-ink-muted shadow-2xs">
          <span className="spinner text-indigo-600" /> Signing in with Google...
        </div>
      ) : (
        <div className="w-full flex justify-center items-center">
          <div ref={googleBtnRef} className="flex justify-center w-full min-h-[40px]" />
        </div>
      )}
    </div>
  );
}
