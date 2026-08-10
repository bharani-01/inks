import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  UploadCloud,
  SlidersHorizontal,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  Clock,
  IndianRupee,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { DEFAULT_PRICING } from '../lib/pricing.js';
import { formatMoney } from '../lib/format.js';
import LandingNav from '../components/landing/LandingNav.jsx';
import Estimator from '../components/landing/Estimator.jsx';
import Reveal from '../components/landing/Reveal.jsx';
import Logo from '../components/Logo.jsx';

const STEPS = [
  { icon: UploadCloud, title: 'Upload', body: 'Drop a PDF, Word doc, slides, or image from your phone or laptop.' },
  { icon: SlidersHorizontal, title: 'Configure', body: 'Colour or B&W, single or double-sided, copies, binding — priced live.' },
  { icon: CreditCard, title: 'Pay', body: 'Confirm the exact total and pay. No surprises at the counter.' },
  { icon: PackageCheck, title: 'Collect', body: 'Track your order from received to ready, then skip the queue.' },
];

const FEATURES = [
  {
    icon: IndianRupee,
    title: 'Transparent pricing',
    body: 'Every option updates the price as you go. The number you confirm is the number you pay.',
  },
  {
    icon: ShieldCheck,
    title: 'Files auto-deleted',
    body: 'Uploaded documents are removed 30 minutes after printing — your coursework stays yours.',
  },
  {
    icon: Clock,
    title: 'Live order tracking',
    body: 'Watch your order move from Received to Printed to Delivered without asking anyone.',
  },
  {
    icon: Layers,
    title: 'Binding & finishing',
    body: 'Add stapling, spiral, or hardcover in one step — handy for reports and lab manuals.',
  },
];

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const [pricing, setPricing] = useState(DEFAULT_PRICING);

  useEffect(() => {
    let active = true;
    api
      .get('/settings/pricing')
      .then((data) => active && data?.pricing && setPricing({ ...DEFAULT_PRICING, ...data.pricing }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dashHref = user?.role === 'ADMIN' ? '/admin/dashboard' : '/user/print';
  const primaryCta = isAuthenticated
    ? { href: dashHref, label: 'Go to your dashboard' }
    : { to: '/register', label: 'Start printing' };

  const bindingRows = [
    { key: 'stapled', label: 'Stapled' },
    { key: 'spiral', label: 'Spiral bound' },
    { key: 'hardcover', label: 'Hardcover' },
  ].filter((r) => pricing.bindingRates && pricing.bindingRates[r.key] != null);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 lg:pt-24 lg:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft text-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              For students · by students
            </span>
            <h1 className="mt-5 font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
              Print it.
              <br />
              <span className="text-accent">Skip the queue.</span>
            </h1>
            <p className="mt-5 text-lg text-ink-soft max-w-md leading-relaxed">
              Upload lab manuals, assignments, and reports from your dorm. Get an exact price, pay
              online, and collect without waiting in line.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta.href ? (
                <a href={primaryCta.href} className="btn btn-ink btn-lg">
                  {primaryCta.label}
                  <ArrowRight size={18} />
                </a>
              ) : (
                <Link to={primaryCta.to} className="btn btn-ink btn-lg">
                  {primaryCta.label}
                  <ArrowRight size={18} />
                </Link>
              )}
              <a href="#how" className="btn btn-secondary btn-lg">
                See how it works
              </a>
            </div>
            <p className="mt-5 text-sm text-ink-muted">
              Printing should be as easy as sending a file.
            </p>
          </div>

          <Reveal className="lg:pl-6">
            <Estimator />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 lg:py-24 border-t border-line">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">
              Four steps, start to collected
            </h2>
            <p className="mt-3 text-ink-soft text-lg">
              No app to install, no account juggling. The whole flow runs in your browser.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 80} className="card p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-10 w-10 rounded-xl bg-accent-soft text-accent inline-flex items-center justify-center">
                    <step.icon size={20} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-ink-faint">Step {i + 1}</span>
                </div>
                <h3 className="font-display font-semibold text-lg">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-24 border-t border-line">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">
              Built for how students actually print
            </h2>
            <p className="mt-3 text-ink-soft text-lg">
              The essentials, done properly — clear prices, private files, and a way to know when your
              order is ready.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70} className="card p-6 flex gap-4">
                <span className="h-11 w-11 shrink-0 rounded-xl bg-ink text-white inline-flex items-center justify-center">
                  <f.icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display font-semibold text-lg">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing (real rates) */}
      <section id="pricing" className="py-16 lg:py-24 border-t border-line">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <Reveal>
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">
              Honest, per-page pricing
            </h2>
            <p className="mt-3 text-ink-soft text-lg">
              These are the live rates from the print desk. Duplex, paper size, and binding adjust the
              total automatically in the print flow.
            </p>
            <p className="mt-6 text-sm text-ink-muted">
              GST of {Math.round((pricing.taxRate || 0.18) * 100)}% applies at checkout. Maximum{' '}
              {pricing.maxPagesPerOrder || 500} pages per order.
            </p>
            <div className="mt-8">
              {isAuthenticated ? (
                <a href={dashHref} className="btn btn-primary btn-lg">
                  Start a print order
                  <ArrowRight size={18} />
                </a>
              ) : (
                <Link to="/register" className="btn btn-primary btn-lg">
                  Create an account
                  <ArrowRight size={18} />
                </Link>
              )}
            </div>
          </Reveal>

          <Reveal className="card p-6 sm:p-8" delay={80}>
            <dl className="divide-y divide-line">
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-ink-soft">Black & white, per page</dt>
                <dd className="font-display font-semibold text-lg">{formatMoney(pricing.bwRate)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-ink-soft">Colour, per page</dt>
                <dd className="font-display font-semibold text-lg">{formatMoney(pricing.colorRate)}</dd>
              </div>
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-ink-soft">Double-sided</dt>
                <dd className="font-medium text-ink">
                  {Math.round((pricing.duplexDiscount || 0) * 100)}% off the page rate
                </dd>
              </div>
              {bindingRows.map((r) => (
                <div key={r.key} className="flex items-baseline justify-between py-3">
                  <dt className="text-ink-soft">{r.label}</dt>
                  <dd className="font-medium text-ink">
                    {pricing.bindingRates[r.key] > 0
                      ? `+ ${formatMoney(pricing.bindingRates[r.key])}`
                      : 'Free'}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Privacy / final CTA */}
      <section id="privacy" className="py-16 lg:py-24 border-t border-line">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="card bg-ink text-white p-8 sm:p-12 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <ShieldCheck size={14} /> Privacy by default
            </span>
            <h2 className="mt-5 font-display font-bold text-3xl sm:text-4xl tracking-tight">
              Your files are deleted after printing
            </h2>
            <p className="mt-3 text-white/70 text-lg max-w-2xl mx-auto">
              Documents are automatically removed 30 minutes after your order is printed. Print what you
              need, then it's gone.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {isAuthenticated ? (
                <a href={dashHref} className="btn btn-primary btn-lg">
                  Go to your dashboard
                </a>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Get started
                  </Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-sm text-ink-muted">
            © {new Date().getFullYear()} Inks by Trackify · For students, by students.
          </p>
        </div>
      </footer>
    </div>
  );
}
