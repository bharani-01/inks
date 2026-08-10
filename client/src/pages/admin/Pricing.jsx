import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Field from '../../components/Field';
import Button from '../../components/Button';
import { Settings, Calculator, Sparkles, Layers, BookOpen, Percent, ShieldAlert } from 'lucide-react';
import { formatMoney } from '../../lib/format';

const DEFAULT_STATE = {
  bwRate: 2.0,
  colorRate: 10.0,
  duplexDiscount: 0.10,
  paperSizeMultipliers: {
    A4: 1.0,
    A3: 1.8,
    LETTER: 1.0,
    LEGAL: 1.2,
  },
  bindingRates: {
    none: 0,
    stapled: 5,
    spiral: 30,
    soft_cover: 50,
    hardcover: 100,
  },
  taxRate: 0.18,
  maxPagesPerOrder: 500,
  minOrderAmount: 0,
  rushFee: 0,
};

export default function Pricing() {
  const [pricing, setPricing] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Interactive Simulator State
  const [simPages, setSimPages] = useState(15);
  const [simCopies, setSimCopies] = useState(1);
  const [simColor, setSimColor] = useState('BW');
  const [simPaper, setSimPaper] = useState('A4');
  const [simSides, setSimSides] = useState('SINGLE');
  const [simBinding, setSimBinding] = useState('none');

  useEffect(() => {
    async function loadPricing() {
      try {
        const data = await api.get('/settings/pricing');
        const p = data.pricing || data;
        setPricing({
          ...DEFAULT_STATE,
          ...p,
          paperSizeMultipliers: {
            ...DEFAULT_STATE.paperSizeMultipliers,
            ...(p.paperSizeMultipliers || {}),
          },
          bindingRates: {
            ...DEFAULT_STATE.bindingRates,
            ...(p.bindingRates || {}),
          },
        });
      } catch (err) {
        toast('Failed to load pricing rules', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadPricing();
  }, [toast]);

  const handleChange = (key, val, isNumber = true) => {
    setPricing((prev) => ({
      ...prev,
      [key]: isNumber ? (val === '' ? '' : parseFloat(val)) : val,
    }));
  };

  const handleNestedChange = (parentKey, childKey, val) => {
    setPricing((prev) => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: val === '' ? '' : parseFloat(val),
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.put('/settings/pricing', pricing);
      const p = data.pricing || data;
      setPricing((prev) => ({
        ...prev,
        ...p,
      }));
      toast('Pricing rules updated successfully', 'success');
    } catch (err) {
      toast(err.message || 'Failed to update pricing rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Calculate simulated preview breakdown
  const simPageRate = simColor === 'COLOR' ? Number(pricing.colorRate || 0) : Number(pricing.bwRate || 0);
  const simDuplexDiscount = simSides === 'DOUBLE' ? Number(pricing.duplexDiscount || 0) : 0;
  const simEffectiveRate = simPageRate * (1 - simDuplexDiscount) * Number(pricing.paperSizeMultipliers?.[simPaper] || 1);
  const simPrintCost = simEffectiveRate * simPages * simCopies;
  const simBindingCost = Number(pricing.bindingRates?.[simBinding] || 0) * simCopies;
  const simSubtotal = simPrintCost + simBindingCost;
  const simTax = simSubtotal * Number(pricing.taxRate || 0.18);
  const simTotal = simSubtotal + simTax;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-line rounded"></div>
        <div className="h-96 bg-line rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Pricing &amp; Cost Rules</h1>
          <p className="text-ink-muted mt-1">
            Configure system-wide printing rates, paper multipliers, binding charges, and taxes.
          </p>
        </div>
        <Button onClick={handleSubmit} loading={saving} className="self-start sm:self-auto">
          Save All Rules
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Settings Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Base Page Rates */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <div className="p-2 rounded-lg bg-accent-soft text-accent">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold font-display text-ink">Base Printing Rates</h2>
                <p className="text-xs text-ink-muted">Standard rate charged per sheet side</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field
                label="Black & White Rate (₹ / page)"
                type="number"
                step="0.1"
                min="0"
                required
                value={pricing.bwRate}
                onChange={(e) => handleChange('bwRate', e.target.value)}
                hint="Cost for 1 page B&W print on A4 single-sided"
              />
              <Field
                label="Full Color Rate (₹ / page)"
                type="number"
                step="0.1"
                min="0"
                required
                value={pricing.colorRate}
                onChange={(e) => handleChange('colorRate', e.target.value)}
                hint="Cost for 1 page color print on A4 single-sided"
              />
            </div>

            <div className="pt-2">
              <Field
                label="Duplex (Double-Sided) Discount (0.0 to 1.0)"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={pricing.duplexDiscount}
                onChange={(e) => handleChange('duplexDiscount', e.target.value)}
                hint="e.g. 0.10 gives a 10% discount per page when printing front & back"
              />
            </div>
          </div>

          {/* Paper Size Multipliers */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Layers size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold font-display text-ink">Paper Size Multipliers</h2>
                <p className="text-xs text-ink-muted">Applied against the base per-page rate</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field
                label="A4 (Standard)"
                type="number"
                step="0.05"
                min="0"
                required
                value={pricing.paperSizeMultipliers?.A4 ?? 1.0}
                onChange={(e) => handleNestedChange('paperSizeMultipliers', 'A4', e.target.value)}
                hint="Default: 1.0x"
              />
              <Field
                label="A3 (Large)"
                type="number"
                step="0.05"
                min="0"
                required
                value={pricing.paperSizeMultipliers?.A3 ?? 1.8}
                onChange={(e) => handleNestedChange('paperSizeMultipliers', 'A3', e.target.value)}
                hint="Default: 1.8x"
              />
              <Field
                label="Letter"
                type="number"
                step="0.05"
                min="0"
                required
                value={pricing.paperSizeMultipliers?.LETTER ?? 1.0}
                onChange={(e) => handleNestedChange('paperSizeMultipliers', 'LETTER', e.target.value)}
                hint="Default: 1.0x"
              />
              <Field
                label="Legal"
                type="number"
                step="0.05"
                min="0"
                required
                value={pricing.paperSizeMultipliers?.LEGAL ?? 1.2}
                onChange={(e) => handleNestedChange('paperSizeMultipliers', 'LEGAL', e.target.value)}
                hint="Default: 1.2x"
              />
            </div>
          </div>

          {/* Binding Options */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <BookOpen size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold font-display text-ink">Binding &amp; Finishing Rates</h2>
                <p className="text-xs text-ink-muted">Fixed charge applied per copy</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field
                label="No Binding (₹)"
                type="number"
                step="1"
                min="0"
                value={pricing.bindingRates?.none ?? 0}
                onChange={(e) => handleNestedChange('bindingRates', 'none', e.target.value)}
              />
              <Field
                label="Stapled Corner (₹)"
                type="number"
                step="1"
                min="0"
                value={pricing.bindingRates?.stapled ?? 5}
                onChange={(e) => handleNestedChange('bindingRates', 'stapled', e.target.value)}
              />
              <Field
                label="Spiral / Coil (₹)"
                type="number"
                step="1"
                min="0"
                value={pricing.bindingRates?.spiral ?? 30}
                onChange={(e) => handleNestedChange('bindingRates', 'spiral', e.target.value)}
              />
              <Field
                label="Soft / Thermal (₹)"
                type="number"
                step="1"
                min="0"
                value={pricing.bindingRates?.soft_cover ?? 50}
                onChange={(e) => handleNestedChange('bindingRates', 'soft_cover', e.target.value)}
              />
              <Field
                label="Hardcover / Thesis (₹)"
                type="number"
                step="1"
                min="0"
                value={pricing.bindingRates?.hardcover ?? 100}
                onChange={(e) => handleNestedChange('bindingRates', 'hardcover', e.target.value)}
              />
            </div>
          </div>

          {/* Limits & Tax */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                <Percent size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold font-display text-ink">Taxes &amp; Order Safeguards</h2>
                <p className="text-xs text-ink-muted">Statutory GST and document safety limits</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field
                label="GST / Tax Rate (0.18 = 18%)"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={pricing.taxRate}
                onChange={(e) => handleChange('taxRate', e.target.value)}
                hint="e.g. 0.18 for 18% GST"
              />
              <Field
                label="Max Pages Per Order"
                type="number"
                step="10"
                min="1"
                value={pricing.maxPagesPerOrder}
                onChange={(e) => handleChange('maxPagesPerOrder', e.target.value)}
                hint="Prevents runaway print batches"
              />
              <Field
                label="Minimum Cart Value (₹)"
                type="number"
                step="1"
                min="0"
                value={pricing.minOrderAmount ?? 0}
                onChange={(e) => handleChange('minOrderAmount', e.target.value)}
                hint="0 = no minimum required"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg" loading={saving}>
              Save Pricing Rules
            </Button>
          </div>
        </form>

        {/* Live Simulator Widget */}
        <aside className="card p-6 bg-paper-sunken/40 sticky top-24 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-line">
            <Calculator size={18} className="text-accent" />
            <h3 className="font-display font-semibold text-ink text-sm">Live Price Simulator</h3>
          </div>
          <p className="text-xs text-ink-muted">
            Test how your pricing rules compute for sample customer configurations in real-time.
          </p>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="font-medium text-ink block mb-1">Color Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimColor('BW')}
                  className={`py-1.5 px-3 rounded-lg border text-center font-medium transition-colors ${
                    simColor === 'BW' ? 'bg-ink text-white border-ink' : 'bg-white text-ink-soft border-line'
                  }`}
                >
                  Black &amp; White
                </button>
                <button
                  type="button"
                  onClick={() => setSimColor('COLOR')}
                  className={`py-1.5 px-3 rounded-lg border text-center font-medium transition-colors ${
                    simColor === 'COLOR' ? 'bg-accent text-white border-accent' : 'bg-white text-ink-soft border-line'
                  }`}
                >
                  Full Color
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-ink block mb-1">Pages</label>
                <input
                  type="number"
                  min="1"
                  value={simPages}
                  onChange={(e) => setSimPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-white text-sm"
                />
              </div>
              <div>
                <label className="font-medium text-ink block mb-1">Copies</label>
                <input
                  type="number"
                  min="1"
                  value={simCopies}
                  onChange={(e) => setSimCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-white text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-ink block mb-1">Paper Size</label>
                <select
                  value={simPaper}
                  onChange={(e) => setSimPaper(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line rounded-lg bg-white text-xs"
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="LETTER">Letter</option>
                  <option value="LEGAL">Legal</option>
                </select>
              </div>
              <div>
                <label className="font-medium text-ink block mb-1">Sides</label>
                <select
                  value={simSides}
                  onChange={(e) => setSimSides(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line rounded-lg bg-white text-xs"
                >
                  <option value="SINGLE">Single-sided</option>
                  <option value="DOUBLE">Double-sided</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-medium text-ink block mb-1">Binding</label>
              <select
                value={simBinding}
                onChange={(e) => setSimBinding(e.target.value)}
                className="w-full px-2 py-1.5 border border-line rounded-lg bg-white text-xs"
              >
                <option value="none">None (₹0)</option>
                <option value="stapled">Stapled (₹{pricing.bindingRates?.stapled || 5})</option>
                <option value="spiral">Spiral Bound (₹{pricing.bindingRates?.spiral || 30})</option>
                <option value="soft_cover">Soft / Thermal (₹{pricing.bindingRates?.soft_cover || 50})</option>
                <option value="hardcover">Hardcover (₹{pricing.bindingRates?.hardcover || 100})</option>
              </select>
            </div>
          </div>

          {/* Breakdown receipt */}
          <div className="pt-3 border-t border-line space-y-1.5 text-xs">
            <div className="flex justify-between text-ink-muted">
              <span>Effective Rate</span>
              <span>₹{simEffectiveRate.toFixed(2)} / pg</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Printing ({simPages * simCopies} pgs)</span>
              <span>{formatMoney(simPrintCost)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Binding</span>
              <span>{formatMoney(simBindingCost)}</span>
            </div>
            <div className="flex justify-between text-ink font-medium pt-1">
              <span>Subtotal</span>
              <span>{formatMoney(simSubtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>GST ({Math.round((pricing.taxRate || 0.18) * 100)}%)</span>
              <span>{formatMoney(simTax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-accent pt-2 border-t border-line">
              <span>Simulated Total</span>
              <span>{formatMoney(simTotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
