import { Check, XCircle } from 'lucide-react';
import { TRACK_STEPS } from '../../lib/status.js';

/**
 * Horizontal order-tracking stepper (Received → Printing → Printed → Delivered).
 * A cancelled order shows a distinct cancelled state.
 */
export default function TrackingStepper({ status }) {
  const cancelled = status === 'CANCELLED';
  const currentIndex = TRACK_STEPS.findIndex((s) => s.key === status);

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
        <XCircle size={18} className="text-danger" />
        <span className="font-medium text-ink">This order was cancelled.</span>
      </div>
    );
  }

  return (
    <ol className="flex items-start">
      {TRACK_STEPS.map((s, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        return (
          <li key={s.key} className="flex flex-col items-center flex-1 relative">
            {i < TRACK_STEPS.length - 1 && (
              <span
                className={`absolute top-4 left-1/2 w-full h-0.5 ${done ? 'bg-accent' : 'bg-line'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 h-8 w-8 rounded-full inline-flex items-center justify-center text-xs font-semibold ${
                done
                  ? 'bg-accent text-white'
                  : active
                  ? 'bg-accent-soft text-accent ring-2 ring-accent'
                  : 'bg-paper-sunken text-ink-faint border border-line'
              }`}
            >
              {done ? <Check size={15} strokeWidth={2.5} /> : i + 1}
            </span>
            <span
              className={`mt-2 text-xs text-center ${
                active ? 'font-semibold text-ink' : done ? 'text-ink-soft' : 'text-ink-faint'
              }`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
