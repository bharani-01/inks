import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Field from '../../components/Field';
import Button from '../../components/Button';
import { Settings, Calculator, Sparkles, Layers, BookOpen, Percent, ShieldAlert, AlertTriangle, CheckCircle2, ArrowRight, Eye, X } from 'lucide-react';
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
  maxBatchFiles: 20,
  minOrderAmount: 0,
  rushFee: 0,
};

export default function Pricing() {
  const [pricing, setPricing] = useState(DEFAULT_STATE);
  const [originalPricing, setOriginalPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
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
        const loadedState = {
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
        };
        setPricing(loadedState);
        setOriginalPricing(JSON.parse(JSON.stringify(loadedState)));
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

  // Compute AWS-style settings diffs
  const FIELD_LABELS = {
    bwRate: 'Black & White Rate (₹/pg)',
    colorRate: 'Full Color Rate (₹/pg)',
    duplexDiscount: 'Duplex Discount Rate',
    taxRate: 'Service Charge Rate',
    maxPagesPerOrder: 'Max Pages Per Order',
    maxBatchFiles: 'Max Batch Files Limit',
    securityCoverMode: 'Security Cover Sheets Mode',
    minOrderAmount: 'Minimum Cart Amount (₹)',
    rushFee: 'Rush Fee (₹)',
  };

  const COVER_MODE_LABELS = {
    BOTH: 'Both Front (Page 1) & Back (Last Page)',
    FRONT_ONLY: 'First Page Only (Front Cover)',
    NONE: 'None (Raw Document Only)',
  };

  const formatVal = (key, val) => {
    if (val === undefined || val === null || val === '') return 'Not set';
    if (key === 'securityCoverMode') return COVER_MODE_LABELS[val] || val;
    if (key === 'taxRate') return `${(Number(val) * 100).toFixed(0)}% (${val})`;
    if (key === 'duplexDiscount') return `${(Number(val) * 100).toFixed(0)}% (${val})`;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const pendingDiffs = (() => {
    if (!originalPricing) return [];
    const diffs = [];

    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      const oldVal = originalPricing[key];
      const newVal = pricing[key];
      if (oldVal !== newVal && newVal !== undefined && newVal !== '') {
        diffs.push({
          key,
          label,
          oldVal: formatVal(key, oldVal),
          newVal: formatVal(key, newVal),
        });
      }
    }

    if (originalPricing.paperSizeMultipliers && pricing.paperSizeMultipliers) {
      for (const [size, mult] of Object.entries(pricing.paperSizeMultipliers)) {
        const oldMult = originalPricing.paperSizeMultipliers[size];
        if (oldMult !== mult) {
          diffs.push({
            key: `paper_${size}`,
            label: `Paper Multiplier (${size})`,
            oldVal: `${oldMult}×`,
            newVal: `${mult}×`,
          });
        }
      }
    }

    if (originalPricing.bindingRates && pricing.bindingRates) {
      for (const [type, rate] of Object.entries(pricing.bindingRates)) {
        const oldRate = originalPricing.bindingRates[type];
        if (oldRate !== rate) {
          diffs.push({
            key: `binding_${type}`,
            label: `Binding Cost (${type})`,
            oldVal: `₹${oldRate}`,
            newVal: `₹${rate}`,
          });
        }
      }
    }

    return diffs;
  })();

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (pendingDiffs.length === 0) {
      toast('No settings changes detected to save', 'info');
      return;
    }
    setReviewModalOpen(true);
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      const data = await api.put('/settings/pricing', pricing);
      const p = data.pricing || data;
      const updatedState = {
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
      };
      setPricing(updatedState);
      setOriginalPricing(JSON.parse(JSON.stringify(updatedState)));
      setReviewModalOpen(false);
      toast('System settings updated successfully', 'success');
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
        <Button onClick={handleFormSubmit} loading={saving} disabled={pendingDiffs.length === 0} className="self-start sm:self-auto">
          {pendingDiffs.length > 0 ? `Review & Save (${pendingDiffs.length})` : 'Save All Rules'}
        </Button>
      </header>

      {/* AWS Console-Style Unsaved Changes Pending Banner */}
      {pendingDiffs.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">Unsaved Configuration Changes ({pendingDiffs.length})</h4>
              <p className="text-xs text-amber-800/90 mt-0.5 font-medium">
                You have {pendingDiffs.length} modified setting{pendingDiffs.length > 1 ? 's' : ''} ready to review before applying to production.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setReviewModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 px-4 rounded-xl shrink-0 border-none shadow-xs"
          >
            <Eye size={14} className="mr-1.5" /> Review Changes ({pendingDiffs.length})
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Settings Form */}
        <form onSubmit={handleFormSubmit} className="lg:col-span-2 space-y-6">
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
                <h2 className="text-base font-semibold font-display text-ink">Service Charges &amp; Order Safeguards</h2>
                <p className="text-xs text-ink-muted">Platform service charge rate and document safety limits</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field
                label="Service Charge Rate (0.18 = 18%)"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={pricing.taxRate}
                onChange={(e) => handleChange('taxRate', e.target.value)}
                hint="e.g. 0.18 for 18% service charge"
              />
              <Field
                label="Max Pages Per Order"
                type="number"
                step="10"
                min="1"
                value={pricing.maxPagesPerOrder}
                onChange={(e) => handleChange('maxPagesPerOrder', e.target.value)}
                hint="Prevents runaway print jobs"
              />
              <Field
                label="Max Batch Files Limit"
                type="number"
                step="1"
                min="1"
                value={pricing.maxBatchFiles ?? 20}
                onChange={(e) => handleChange('maxBatchFiles', e.target.value)}
                hint="Default: 20 files per batch"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink block">
                  Security Cover Sheets Mode
                </label>
                <select
                  value={pricing.securityCoverMode || 'BOTH'}
                  onChange={(e) => handleChange('securityCoverMode', e.target.value, false)}
                  className="field-input text-xs h-10 w-full"
                >
                  <option value="BOTH">Both Front (Page 1) &amp; Back (Last Page)</option>
                  <option value="FRONT_ONLY">First Page Only (Front Cover)</option>
                  <option value="NONE">None (Raw Document Only)</option>
                </select>
                <p className="text-[11px] text-ink-muted">Auto-attaches security cover page(s)</p>
              </div>
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
              <span>Service Charge ({Math.round((pricing.taxRate || 0.18) * 100)}%)</span>
              <span>{formatMoney(simTax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-accent pt-2 border-t border-line">
              <span>Simulated Total</span>
              <span>{formatMoney(simTotal)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* AWS Console-Style Review & Confirm Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-line max-w-2xl w-full overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-line bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white">Review &amp; Apply Configuration Changes</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="border border-line rounded-2xl overflow-hidden divide-y divide-line text-xs">
                <div className="grid grid-cols-12 bg-slate-100/80 p-3 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  <div className="col-span-5">Setting / Parameter</div>
                  <div className="col-span-3">Current Value</div>
                  <div className="col-span-4">Proposed New Value</div>
                </div>

                {pendingDiffs.map((diff) => (
                  <div key={diff.key} className="grid grid-cols-12 p-3 items-center hover:bg-slate-50">
                    <div className="col-span-5 font-bold text-slate-900">{diff.label}</div>
                    <div className="col-span-3 text-slate-500 line-through truncate">{diff.oldVal}</div>
                    <div className="col-span-4 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-center truncate flex items-center justify-between gap-1">
                      <span className="truncate">{diff.newVal}</span>
                      <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Production Impact Notice</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Saving these settings will immediately apply to all new print orders, security cover generation, and operator station dashboards.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-line bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="btn bg-white hover:bg-slate-100 border border-line text-slate-700 font-bold text-xs h-10 px-4 rounded-xl cursor-pointer"
              >
                Cancel &amp; Edit
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={saving}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <span>Applying Changes...</span>
                ) : (
                  <>
                    <span>Confirm &amp; Apply Changes ({pendingDiffs.length})</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
