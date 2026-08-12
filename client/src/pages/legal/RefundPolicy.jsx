import LegalLayout from './LegalLayout.jsx';

export default function RefundPolicy() {
  return (
    <LegalLayout
      title="Refund &amp; Cancellation Policy"
      subtitle="Clear, fair, and automated policies for print order cancellations, defective prints, and wallet balances."
      lastUpdated="August 12, 2026"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">1. Overview</h2>
        <p>
          At Inks, customer satisfaction and fair pricing are our top priorities. Because printing involves customized physical output and consumable media (paper, toner, binding spines), our refund and cancellation policies are structured to be fast, clear, and transparent.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">2. Order Cancellation Window</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="font-bold text-emerald-950 block">Before Physical Printing (Status: Received)</span>
            <p className="text-emerald-900 leading-relaxed">
              <strong>100% Instant Refund:</strong> If you cancel your order before the printer operator initiates the physical print run, the entire order amount is instantly credited back to your Inks Print Wallet.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
            <span className="font-bold text-amber-950 block">After Printing Initiated (Status: Processing / Printed)</span>
            <p className="text-amber-900 leading-relaxed">
              Once paper feeding and toner application have started, print orders cannot be cancelled since raw materials and machine time have already been consumed.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">3. Misprint &amp; Quality Guarantee</h2>
        <p>
          If your printed document has physical station defects, you are eligible for an <strong>instant free reprint</strong> or a <strong>100% wallet credit</strong> under any of the following circumstances:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-ink-soft">
          <li>Hardware printer errors (toner streaks, blotches, paper creases, or smudges).</li>
          <li>Incorrect binding type or missing pages caused by machine error.</li>
          <li>Printing in Black &amp; White when Colour was selected and paid for.</li>
          <li>Inverted duplex or misaligned page rotation caused by station processing.</li>
        </ul>
        <p className="text-xs text-ink-muted">
          <em>Note:</em> Quality guarantees do not cover resolution pixelation or formatting defects that were already present in your original submitted file.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display font-bold text-ink">4. How to Request a Quality Refund</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-ink-soft">
          <li>Present the defective copy to the station operator within <strong>2 hours</strong> of pickup, or</li>
          <li>Submit a ticket in the <a href="/user/support" className="text-teal-700 font-semibold underline">Inks Support Portal</a> with your Order ID and photo of the issue.</li>
          <li>Upon quick verification, wallet credit is issued instantly to your balance.</li>
        </ol>
      </section>
    </LegalLayout>
  );
}
