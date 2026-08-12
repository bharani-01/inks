import LegalLayout from './LegalLayout.jsx';

export default function TermsAndConditions() {
  return (
    <LegalLayout
      title="Terms &amp; Conditions of Service"
      subtitle="The rules, responsibilities, and guidelines for using the Inks campus printing platform."
      lastUpdated="August 12, 2026"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">1. Acceptance of Terms</h2>
        <p>
          By creating an account, uploading documents, topping up a wallet balance, or placing an order on <strong>Inks</strong>, you agree to be bound by these Terms &amp; Conditions and all applicable laws and campus regulations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">2. Permissible Use &amp; Prohibited Content</h2>
        <p>
          Inks is designed for academic, institutional, and legitimate personal printing. You expressly agree that you will not upload or request the printing of:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-ink-soft">
          <li>Content that infringes copyright, patent, trademark, or intellectual property rights of third parties without license or fair-use exemption.</li>
          <li>Defamatory, obscene, abusive, pornographic, or unlawful material under Indian Penal Code / Cyber Laws.</li>
          <li>Forged credentials, counterfeit government identity proofs, or unauthorized institutional stationery.</li>
          <li>Malicious software payloads, virus-infected macro documents, or exploit code.</li>
        </ul>
        <p className="text-xs text-ink-muted">
          Inks reserves the absolute right to refuse fulfillment of any print job that violates campus safety guidelines or legal statutes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">3. Order Fulfillment &amp; Pickup</h2>
        <ul className="list-disc list-inside space-y-1.5 text-ink-soft">
          <li><strong>Real-time Tracking:</strong> Once submitted, your order status moves from <em>Received</em> &rarr; <em>Processing</em> &rarr; <em>Printed</em> &rarr; <em>Delivered</em>.</li>
          <li><strong>Collection Window:</strong> Physical printed copies are held securely at the designated print station for up to <strong>48 hours</strong> after completion.</li>
          <li><strong>Verification:</strong> You must present your Order Number QR code or registered confirmation email at the pickup desk to verify ownership before release.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">4. Pricing, Payments &amp; Wallet</h2>
        <p>
          Print rates (black &amp; white, colour, duplex discount, binding charges) are calculated dynamically before order confirmation. What you confirm at checkout is the exact total charged to your wallet or online payment method.
        </p>
        <p>
          Promotional coupon discounts and wallet balance top-ups are non-transferable between accounts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">5. Limitation of Liability</h2>
        <p>
          Inks is not liable for typographical errors, formatting corruptions, or resolution defects present in your original source files. Please preview your documents before submitting.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">6. Governing Law</h2>
        <p>
          These Terms are governed by and construed under the laws of the Republic of India. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in Chennai, Tamil Nadu, India.
        </p>
      </section>
    </LegalLayout>
  );
}
