import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../Logo.jsx';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#privacy', label: 'Privacy' },
];

export default function LandingNav() {
  const { isAuthenticated, user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dashHref = user?.role === 'ADMIN' ? '/admin/dashboard' : '/user/print';

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        scrolled ? 'bg-paper/85 backdrop-blur border-b border-line' : 'bg-transparent'
      }`}
    >
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-soft hover:text-ink transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <a href={dashHref} className="btn btn-primary">
              Go to Dashboard
            </a>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-ink">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg text-ink-soft hover:bg-paper-hover"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-line bg-paper/95 backdrop-blur">
          <nav className="px-4 py-4 flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 mt-2">
              {isAuthenticated ? (
                <a href={dashHref} className="btn btn-primary btn-block">
                  Go to Dashboard
                </a>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary btn-block" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link to="/register" className="btn btn-ink btn-block" onClick={() => setOpen(false)}>
                    Get started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
