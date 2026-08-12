import { Link, NavLink, useLocation } from 'react-router-dom';
import { ShieldCheck, FileText, Cookie, RotateCcw, ArrowLeft, Printer, ExternalLink } from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import Footer from '../../components/Footer.jsx';

const LEGAL_NAV = [
  { to: '/privacy-policy', label: 'Privacy Policy', icon: ShieldCheck },
  { to: '/terms-and-conditions', label: 'Terms & Conditions', icon: FileText },
  { to: '/cookie-policy', label: 'Cookie Policy', icon: Cookie },
  { to: '/refund-policy', label: 'Refund & Cancellation', icon: RotateCcw },
];

export default function LegalLayout({ title, subtitle, lastUpdated, children }) {
  const location = useLocation();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-line">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-xl border border-line text-ink-muted hover:text-ink hover:bg-paper-hover transition-colors"
              title="Return to Home"
            >
              <ArrowLeft size={17} />
            </Link>
            <Logo />
            <span className="hidden sm:inline text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Legal &amp; Trust
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-secondary text-xs h-8 px-2.5 inline-flex items-center gap-1.5 rounded-xl"
              title="Print document"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print Copy</span>
            </button>
            <Link to="/login" className="btn btn-primary text-xs h-8 px-3.5 rounded-xl font-bold">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full flex-1">
        {/* Document Header */}
        <div className="border-b border-line pb-8 mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
              <ShieldCheck size={13} className="text-teal-600" /> Official Legal Agreement
            </span>
            {lastUpdated && (
              <span className="text-xs text-ink-muted">
                Effective: <strong>{lastUpdated}</strong>
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-base sm:text-lg text-ink-soft max-w-3xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Navigation Sidebar */}
          <aside className="lg:sticky lg:top-24 space-y-2 order-2 lg:order-1">
            <div className="p-3.5 rounded-2xl bg-white border border-line shadow-xs space-y-1">
              <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider px-2 py-1">
                Legal Documents
              </p>
              {LEGAL_NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-ink-soft hover:text-ink hover:bg-paper-hover'
                    }`
                  }
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/70 to-emerald-50/70 border border-teal-200 text-xs space-y-2">
              <p className="font-bold text-teal-950">Questions or inquiries?</p>
              <p className="text-teal-900/80 leading-relaxed">
                Contact our data protection and compliance team at{' '}
                <a href="mailto:support@trekkly.in" className="font-semibold text-teal-700 underline">
                  support@trekkly.in
                </a>
              </p>
            </div>
          </aside>

          {/* Legal Document Body */}
          <article className="lg:col-span-3 card p-6 sm:p-10 bg-white border border-line shadow-xs order-1 lg:order-2 prose prose-slate max-w-none text-ink text-sm sm:text-base leading-relaxed space-y-6">
            {children}
          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
}
