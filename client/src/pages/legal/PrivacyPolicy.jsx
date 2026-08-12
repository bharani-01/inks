import LegalLayout from './LegalLayout.jsx';

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How Inks collects, processes, encrypts, and auto-deletes your documents and personal data."
      lastUpdated="August 12, 2026"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">1. Introduction &amp; Commitment</h2>
        <p>
          At <strong>Inks</strong> (operated by Trackify / Trekkly Technologies), we recognize the sensitivity of academic records, research papers, assignments, and personal documents. We are committed to protecting your privacy in full compliance with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and international data protection standards.
        </p>
        <p>
          This policy details what data we collect, why we collect it, our automated lifecycle deletion guarantees, and your rights over your data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">2. Document Storage &amp; 30-Minute Auto-Purge</h2>
        <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 text-xs sm:text-sm text-teal-950 space-y-2">
          <p className="font-bold flex items-center gap-1.5 text-teal-900">
            🛡️ Zero Long-Term Document Retention Guarantee
          </p>
          <p>
            When you upload a file for printing (PDF, DOCX, PPTX, JPG, PNG), it is temporarily stored in an encrypted vault. <strong>Exactly 30 minutes after your order is physically printed or completed</strong>, our automated garbage collector permanently purges the raw file from all disks and database records.
          </p>
        </div>
        <ul className="list-disc list-inside space-y-1.5 text-ink-soft">
          <li><strong>Zero Content Telemetry:</strong> We do not scan, index, read, or train artificial intelligence models on your uploaded files.</li>
          <li><strong>Restricted Operator Access:</strong> Station operators can only view document metadata (file name, page count, color specifications) necessary to complete printing.</li>
          <li><strong>Cover Sheet Anonymization:</strong> Front and back security cover pages ensure your document content is never exposed to third parties in the pickup trays.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">3. Information We Collect</h2>
        <p>We collect only the minimum required data to provide printing services:</p>
        <ul className="list-disc list-inside space-y-1.5 text-ink-soft">
          <li><strong>Account Details:</strong> Name, email address, student ID or phone number (optional), and encrypted password hash.</li>
          <li><strong>OAuth Credentials:</strong> If signing in with Google, we receive your name, email, and profile image from Google OAuth. We never access your Google Drive or private Google data.</li>
          <li><strong>Transaction &amp; Order History:</strong> Order numbers, page counts, paper sizes, timestamps, and payment status.</li>
          <li><strong>Wallet Records:</strong> Balance credits, coupon redemptions, and top-up receipts.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">4. Security &amp; Encryption</h2>
        <p>
          All data transmitted between your browser or mobile phone and Inks servers is protected using <strong>TLS 1.3 encryption (HTTPS)</strong>. Passwords are salted and hashed using industry-standard <code>bcrypt</code> algorithms with zero plain-text storage.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">5. Cookies &amp; Local Storage</h2>
        <p>
          We use strictly necessary session cookies and token local storage to maintain your logged-in session, remember your station accessibility preferences (font scaling, density, language), and preserve your active print queue cart.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">6. Your Rights &amp; Data Erasure</h2>
        <p>
          You have the full right to inspect your order logs, update your account information, or request immediate permanent account deletion. To request an account erasure, visit your profile page or contact <a href="mailto:support@trekkly.in" className="text-teal-700 font-semibold underline">support@trekkly.in</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
