import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Printer,
  Sparkles,
  Heart,
  Globe,
  Mail,
  Phone,
  FileText,
  Cookie,
  RotateCcw,
  Layers,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Logo from './Logo.jsx';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-line text-ink relative overflow-hidden">
      {/* Top Banner / Trust Bar */}
      <div className="border-b border-line bg-paper-sunken/60 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-content mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-200">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">30-Min Auto-Purge</p>
              <p className="text-[11px] text-ink-muted">Files deleted automatically post print</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
              <Lock size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">256-Bit Encrypted</p>
              <p className="text-[11px] text-ink-muted">Secure in-transit &amp; rest protection</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Skip the Queue</p>
              <p className="text-[11px] text-ink-muted">Instant notification when ready</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Instant Wallet Topups</p>
              <p className="text-[11px] text-ink-muted">Zero payment gateway friction</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Column 1: Brand & Tagline */}
          <div className="lg:col-span-2 space-y-4">
            <Logo />
            <p className="text-xs sm:text-sm text-ink-soft max-w-sm leading-relaxed">
              Inks by Trackify is the intelligent campus printing ecosystem. Upload lab records,
              assignments, and notes from anywhere, configure live rates, and pick up without waiting
              in line.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-paper-sunken border border-line font-medium">
                <Globe size={13} className="text-teal-700" /> Made for Universities &amp; Students
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-paper-sunken border border-line font-medium">
                🇮🇳 Hosted in India
              </span>
            </div>
          </div>

          {/* Column 2: Platform & Products */}
          <div className="space-y-3">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              Platform &amp; Print
            </p>
            <ul className="space-y-2 text-xs text-ink-soft">
              <li>
                <Link to="/register" className="hover:text-teal-700 transition-colors">
                  Document Upload
                </Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-teal-700 transition-colors">
                  Live Order Tracker
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-teal-700 transition-colors">
                  Campus Print Wallet
                </Link>
              </li>
              <li>
                <a href="/#pricing" className="hover:text-teal-700 transition-colors">
                  Pricing &amp; Rates
                </a>
              </li>
              <li>
                <Link to="/login" className="hover:text-teal-700 transition-colors">
                  Station Operator Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Governance */}
          <div className="space-y-3">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              Legal &amp; Compliance
            </p>
            <ul className="space-y-2 text-xs text-ink-soft">
              <li>
                <Link to="/privacy-policy" className="hover:text-teal-700 transition-colors flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-teal-600" /> Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-and-conditions" className="hover:text-teal-700 transition-colors flex items-center gap-1.5">
                  <FileText size={13} className="text-teal-600" /> Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookie-policy" className="hover:text-teal-700 transition-colors flex items-center gap-1.5">
                  <Cookie size={13} className="text-teal-600" /> Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-teal-700 transition-colors flex items-center gap-1.5">
                  <RotateCcw size={13} className="text-teal-600" /> Refund &amp; Cancellation
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Support */}
          <div className="space-y-3">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              Support &amp; Campus
            </p>
            <ul className="space-y-2 text-xs text-ink-soft">
              <li>
                <a href="mailto:support@trekkly.in" className="hover:text-teal-700 transition-colors flex items-center gap-1.5">
                  <Mail size={13} className="text-teal-600" /> support@trekkly.in
                </a>
              </li>
              <li>
                <Link to="/user/support" className="hover:text-teal-700 transition-colors">
                  Help Desk &amp; Tickets
                </Link>
              </li>
              <li>
                <a href="/#estimator" className="hover:text-teal-700 transition-colors">
                  Cost Calculator
                </a>
              </li>
              <li>
                <span className="text-ink-muted text-[11px]">
                  Response time: &lt; 15 mins during station hours
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Sub-Footer Bar */}
      <div className="border-t border-line bg-paper-sunken/40 py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-content mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
          <p>© {currentYear} Inks by Trackify. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-teal-700 transition-colors">
              Privacy
            </Link>
            <span className="h-3 w-px bg-line" aria-hidden="true" />
            <Link to="/terms-and-conditions" className="hover:text-teal-700 transition-colors">
              Terms
            </Link>
            <span className="h-3 w-px bg-line" aria-hidden="true" />
            <Link to="/cookie-policy" className="hover:text-teal-700 transition-colors">
              Cookies
            </Link>
            <span className="h-3 w-px bg-line" aria-hidden="true" />
            <Link to="/refund-policy" className="hover:text-teal-700 transition-colors">
              Refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
