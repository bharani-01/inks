import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Layers,
  Palette,
  BookOpen,
  Clock,
  ShieldCheck,
  HelpCircle,
  Printer,
  Lightbulb,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { DEFAULT_PRICING } from '../../lib/pricing.js';
import { formatMoney } from '../../lib/format.js';

const PAPER_LABELS = { A4: 'A4 (210 × 297 mm)', A3: 'A3 (297 × 420 mm)', LETTER: 'Letter (8.5 × 11 in)', LEGAL: 'Legal (8.5 × 14 in)' };
const BINDING_LABELS = { none: 'No binding', stapled: 'Stapled', spiral: 'Spiral', hardcover: 'Hardcover' };

function Card({ icon: Icon, title, children }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-9 w-9 rounded-xl bg-accent-soft text-accent inline-flex items-center justify-center">
          <Icon size={18} />
        </span>
        <h2 className="font-display font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function Support() {
  const [pricing, setPricing] = useState(DEFAULT_PRICING);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get('/settings/pricing');
        if (active && data?.pricing) setPricing({ ...DEFAULT_PRICING, ...data.pricing });
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const papers = Object.keys(pricing.paperSizeMultipliers || {});
  const bindings = Object.entries(pricing.bindingRates || {});
  const retentionNote = 'Uploaded files are automatically deleted for privacy ~30 minutes after your order is printed.';

  return (
    <div className="max-w-content mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-accent text-white mb-6 shadow-card">
        <div
          className="absolute inset-0 opacity-70"
          style={{ background: 'linear-gradient(120deg, #4338CA 0%, #3A30B0 55%, #2C2585 100%)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between gap-4 p-6 sm:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Support</p>
            <h1 className="mt-1 font-display font-bold text-2xl sm:text-3xl tracking-tight">Print guidelines &amp; help</h1>
            <p className="mt-1.5 text-sm sm:text-base text-white/80 max-w-md">
              Everything you need for a clean print, first time.
            </p>
          </div>
          <span
            className="hidden sm:inline-flex h-20 w-20 lg:h-24 lg:w-24 shrink-0 rounded-3xl bg-white/15 ring-1 ring-white/25 items-center justify-center backdrop-blur-sm"
            aria-hidden="true"
          >
            <Lightbulb size={44} className="text-white" strokeWidth={1.5} />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Supported files */}
        <Card icon={FileText} title="Supported files">
          <ul className="text-sm text-ink-soft space-y-2">
            <li className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <span>Documents</span>
              <span className="font-medium text-ink">PDF, DOC, DOCX, TXT</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <span>Presentations &amp; sheets</span>
              <span className="font-medium text-ink">PPT, PPTX, XLS, XLSX</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <span>Images</span>
              <span className="font-medium text-ink">PNG, JPG, WEBP, GIF, SVG</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Maximum size</span>
              <span className="font-medium text-ink">10 MB per file</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Tip: PDFs give the most reliable layout — export to PDF before uploading Office files when you can.
          </p>
        </Card>

        {/* Paper sizes */}
        <Card icon={Layers} title="Paper sizes">
          <ul className="text-sm text-ink-soft space-y-2">
            {papers.map((p) => {
              const mult = pricing.paperSizeMultipliers[p];
              return (
                <li key={p} className="flex justify-between gap-4 border-b border-dashed border-line pb-2 last:border-0">
                  <span>{PAPER_LABELS[p] || p}</span>
                  <span className="font-medium text-ink">
                    {mult === 1 ? 'Standard rate' : `${mult}× page rate`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Colour & pricing */}
        <Card icon={Palette} title="Colour &amp; page rates">
          <ul className="text-sm text-ink-soft space-y-2">
            <li className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <span>Black &amp; white</span>
              <span className="font-medium text-ink">{formatMoney(pricing.bwRate)}/page</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <span>Full colour</span>
              <span className="font-medium text-ink">{formatMoney(pricing.colorRate)}/page</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-dashed border-line pb-2">
              <span>Double-sided discount</span>
              <span className="font-medium text-ink">{Math.round((pricing.duplexDiscount || 0) * 100)}% off pages</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>GST</span>
              <span className="font-medium text-ink">{Math.round((pricing.taxRate || 0) * 100)}%</span>
            </li>
          </ul>
        </Card>

        {/* Binding */}
        <Card icon={BookOpen} title="Binding options">
          <ul className="text-sm text-ink-soft space-y-2">
            {bindings.map(([key, rate]) => (
              <li key={key} className="flex justify-between gap-4 border-b border-dashed border-line pb-2 last:border-0">
                <span>{BINDING_LABELS[key] || key}</span>
                <span className="font-medium text-ink">{rate > 0 ? `+ ${formatMoney(rate)} per copy` : 'Free'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Orders are limited to {pricing.maxPagesPerOrder || 500} pages each.
          </p>
        </Card>

        {/* Privacy */}
        <Card icon={ShieldCheck} title="Your files &amp; privacy">
          <p className="text-sm text-ink-soft">{retentionNote}</p>
          <p className="mt-2 text-sm text-ink-soft">
            Only you (and the print desk fulfilling your order) can access your uploads. You can delete
            any document yourself from{' '}
            <Link to="/user/documents" className="font-semibold text-accent hover:text-accent-hover">
              My documents
            </Link>
            .
          </p>
        </Card>

        {/* How collection works */}
        <Card icon={Clock} title="How collection works">
          <ol className="text-sm text-ink-soft space-y-2 list-decimal list-inside">
            <li>Upload your file and choose your print options.</li>
            <li>Pay online — you'll get an order code like <span className="font-medium text-ink">PRT-XXXXXX</span>.</li>
            <li>Track your order status from <Link to="/user/orders" className="font-semibold text-accent hover:text-accent-hover">My orders</Link>.</li>
            <li>Collect at the print desk once it shows <span className="font-medium text-ink">Printed</span>.</li>
          </ol>
        </Card>
      </div>

      {/* Still need help */}
      <div className="card p-5 sm:p-6 mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="h-11 w-11 rounded-xl bg-accent-soft text-accent inline-flex items-center justify-center shrink-0">
          <HelpCircle size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold text-ink">Still stuck?</h2>
          <p className="text-sm text-ink-muted">
            Reach out to the print desk with your order code and we'll sort it out.
          </p>
        </div>
        <Link to="/user/print" className="btn btn-primary shrink-0">
          <Printer size={18} /> Start a print
        </Link>
      </div>
    </div>
  );
}
