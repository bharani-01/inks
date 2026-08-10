import { useState } from 'react';
import { Smartphone, CreditCard, Wallet, Lock } from 'lucide-react';
import Modal from '../Modal.jsx';
import Button from '../Button.jsx';
import { formatMoney } from '../../lib/format.js';

const METHODS = [
  { value: 'SIMULATED_UPI', label: 'UPI', hint: 'Pay by any UPI app', icon: Smartphone },
  { value: 'SIMULATED_CARD', label: 'Card', hint: 'Credit or debit card', icon: CreditCard },
  { value: 'SIMULATED_WALLET', label: 'Wallet', hint: 'Campus wallet balance', icon: Wallet },
];

/**
 * Simulated payment modal. Payments are not real — the backend marks the order
 * PAID on submission. The 1.5s delay lives in the parent's confirm handler.
 */
export default function PaymentModal({ open, onClose, total, processing, onConfirm }) {
  const [method, setMethod] = useState('SIMULATED_UPI');

  return (
    <Modal
      open={open}
      onClose={processing ? undefined : onClose}
      title="Confirm & pay"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(method)}
            loading={processing}
            loadingText="Processing payment…"
          >
            Pay {formatMoney(total)}
          </Button>
        </>
      }
    >
      <div className="flex items-baseline justify-between rounded-xl bg-paper-sunken border border-line px-4 py-3">
        <span className="text-sm text-ink-muted">Amount payable</span>
        <span className="font-display font-bold text-2xl text-accent">{formatMoney(total)}</span>
      </div>

      <fieldset className="mt-5" disabled={processing}>
        <legend className="field-label">Payment method</legend>
        <div className="space-y-2">
          {METHODS.map((m) => {
            const active = method === m.value;
            return (
              <label
                key={m.value}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-paper-hover'
                }`}
              >
                <input
                  type="radio"
                  name="payMethod"
                  value={m.value}
                  checked={active}
                  onChange={() => setMethod(m.value)}
                  className="sr-only"
                />
                <span
                  className={`h-10 w-10 rounded-lg inline-flex items-center justify-center ${
                    active ? 'bg-accent text-white' : 'bg-paper-sunken text-ink-muted'
                  }`}
                >
                  <m.icon size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink">{m.label}</span>
                  <span className="block text-xs text-ink-muted">{m.hint}</span>
                </span>
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    active ? 'border-accent bg-accent' : 'border-line'
                  }`}
                  aria-hidden="true"
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-muted">
        <Lock size={13} />
        Demo checkout — no real payment is processed.
      </p>
    </Modal>
  );
}
