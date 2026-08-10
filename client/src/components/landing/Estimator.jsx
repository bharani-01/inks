import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { calculateBreakdown, DEFAULT_PRICING } from '../../lib/pricing.js';
import { formatMoney } from '../../lib/format.js';

const COLOR_OPTIONS = [
  { value: 'BW', label: 'Black & White' },
  { value: 'COLOR', label: 'Colour' },
];
const SIDES_OPTIONS = [
  { value: 'SINGLE', label: 'Single-sided' },
  { value: 'DOUBLE', label: 'Double-sided' },
];

function Segmented({ label, value, onChange, options, name }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-paper-sunken rounded-xl border border-line" role="group" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              name={name}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Public price estimator. Reads real, admin-configured rates from the public
 * GET /settings/pricing and computes the breakdown client-side (the /calculate
 * endpoint requires auth), using the exact backend formula.
 */
export default function Estimator() {
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [color, setColor] = useState('BW');
  const [sides, setSides] = useState('SINGLE');
  const [pages, setPages] = useState(10);

  useEffect(() => {
    let active = true;
    api
      .get('/settings/pricing')
      .then((data) => {
        if (active && data?.pricing) setPricing({ ...DEFAULT_PRICING, ...data.pricing });
      })
      .catch(() => {
        /* keep defaults if the public endpoint is unavailable */
      });
    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.min(Number(pricing.maxPagesPerOrder) || 500, parseInt(pages, 10) || 1));

  const breakdown = useMemo(
    () =>
      calculateBreakdown(
        { colorMode: color, sides, copies: 1, binding: 'none', paperSize: 'A4', totalPages },
        pricing
      ),
    [color, sides, totalPages, pricing]
  );

  return (
    <div className="card p-5 sm:p-6 shadow-card-hover">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-ink text-lg">Estimate your print</h3>
          <p className="text-xs text-ink-muted mt-0.5">Live rates. What you see is what you pay.</p>
        </div>
        <span className="badge badge-accent">A4</span>
      </div>

      <div className="space-y-4">
        <Segmented label="Colour" value={color} onChange={setColor} options={COLOR_OPTIONS} name="est-color" />
        <Segmented label="Sides" value={sides} onChange={setSides} options={SIDES_OPTIONS} name="est-sides" />

        <div>
          <label htmlFor="est-pages" className="field-label">
            Pages
          </label>
          <input
            id="est-pages"
            type="number"
            min={1}
            max={pricing.maxPagesPerOrder || 500}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            className="field-input"
          />
        </div>
      </div>

      <dl className="mt-5 pt-4 border-t border-line space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">
            Rate ({color === 'COLOR' ? 'colour' : 'B&W'}
            {sides === 'DOUBLE' ? ', duplex' : ''})
          </dt>
          <dd className="text-ink-soft font-medium">{formatMoney(breakdown.effectivePageRate)}/pg</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="text-ink-soft font-medium">{formatMoney(breakdown.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">
            GST ({Math.round((breakdown.taxRate || 0) * 100)}%)
          </dt>
          <dd className="text-ink-soft font-medium">{formatMoney(breakdown.tax)}</dd>
        </div>
        <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-line">
          <dt className="font-display font-semibold text-ink">Total</dt>
          <dd className="font-display font-bold text-2xl text-accent">{formatMoney(breakdown.totalAmount)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[0.6875rem] text-ink-faint leading-relaxed">
        Estimate for one A4 document, single copy, no binding. Final price is confirmed in the print
        flow before you pay.
      </p>
    </div>
  );
}
