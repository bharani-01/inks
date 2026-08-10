import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

/** Shared shell for the login/register pages — paper background, centered card. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="px-5 sm:px-8 py-5">
        <Logo />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="card p-7 sm:p-8 animate-fade-up">
            <div className="mb-6">
              <h1 className="text-2xl font-display font-bold text-ink tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-ink-muted mt-1.5">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <p className="text-center text-sm text-ink-muted mt-6">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

export function AuthFooterLink({ prompt, to, label }) {
  return (
    <>
      {prompt}{' '}
      <Link to={to} className="text-accent font-semibold hover:text-accent-hover">
        {label}
      </Link>
    </>
  );
}
