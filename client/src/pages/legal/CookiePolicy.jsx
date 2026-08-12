import LegalLayout from './LegalLayout.jsx';

export default function CookiePolicy() {
  return (
    <LegalLayout
      title="Cookie &amp; Local Storage Policy"
      subtitle="How Inks uses cookies, local browser tokens, and session identifiers to deliver seamless print experiences."
      lastUpdated="August 12, 2026"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">1. What are Cookies &amp; Local Storage?</h2>
        <p>
          Cookies and HTML5 Local Storage are small text files or key-value data structures placed on your computer, tablet, or smartphone when you browse websites. They enable the station to remember your login session, dark mode, accessibility font scale, and shopping cart.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">2. Categories of Storage We Use</h2>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-paper-sunken border border-line space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink text-sm">Essential &amp; Authentication (Strictly Necessary)</h3>
              <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">Required</span>
            </div>
            <p className="text-xs text-ink-soft">
              Maintains your authenticated JWT token, secures API requests against Cross-Site Request Forgery (CSRF), and preserves session state between page refreshes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-paper-sunken border border-line space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink text-sm">Station Accessibility &amp; UX Preferences</h3>
              <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">Functional</span>
            </div>
            <p className="text-xs text-ink-soft">
              Saves your preferred UX4G font scale (70%–250%), table spacing density, high-contrast toggle, sidebar collapse status, and station language (English, Hindi, Tamil, Telugu, Kannada, Malayalam).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-paper-sunken border border-line space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink text-sm">Print Queue &amp; Cart State</h3>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Operational</span>
            </div>
            <p className="text-xs text-ink-soft">
              Caches pending document selections and live quote configurations so you don't lose your order details when navigating between tabs.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">3. Third-Party Tracking Policy</h2>
        <p>
          <strong>We do NOT sell your browsing behavior or document history to third-party ad networks.</strong> Third-party services embedded on Inks (such as Google OAuth for sign-in or Microsoft Clarity for interface heatmaps) operate under strict non-disclosure privacy agreements.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">4. How to Control Cookies</h2>
        <p>
          You can clear your browser cookies and local storage anytime via your browser settings (Chrome, Safari, Firefox, Edge). Note that disabling essential session storage will prevent you from signing in to your printing account.
        </p>
      </section>
    </LegalLayout>
  );
}
