import { Check } from 'lucide-react';

const STEPS = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'Print Options' },
  { n: 3, label: 'Review & Price' },
  { n: 4, label: 'Checkout' },
];

/**
 * Print-wizard step indicator: numbered circles with labels stacked beneath and
 * dashed connectors between them (matches the Print Hub design). Completed steps
 * are clickable to navigate back; the current step is highlighted.
 */
export default function WizardSteps({ current, onStepClick }) {
  return (
    <ol className="flex items-start w-full" aria-label="Print progress">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const clickable = done && typeof onStepClick === 'function';
        return (
          <li key={s.n} className="flex items-start flex-1 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(s.n)}
              className={`flex flex-col items-center gap-2 shrink-0 ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-accent text-white shadow-sm'
                    : done
                    ? 'bg-accent text-white'
                    : 'bg-white text-ink-faint border-2 border-line'
                }`}
              >
                {done ? <Check size={16} strokeWidth={2.5} /> : s.n}
              </span>
              <span
                className={`text-[0.625rem] sm:text-xs font-medium text-center leading-tight max-w-[3.75rem] sm:max-w-none ${
                  active ? 'text-accent' : done ? 'text-ink-soft' : 'text-ink-faint'
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={`flex-1 mt-4 sm:mt-5 mx-1 sm:mx-3 border-t-2 border-dashed ${
                  s.n < current ? 'border-accent/50' : 'border-line'
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
