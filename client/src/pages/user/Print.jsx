import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud,
  Search,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Loader2,
  FolderOpen,
  Folder,
  ChevronRight,
  MoreVertical,
  Eye,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { api, uploadFile, previewUrl } from '../../lib/api.js';
import { DEFAULT_PRICING, estimatePagesFromRange } from '../../lib/pricing.js';
import { formatMoney, formatFileSize, formatDate, formatDateTime } from '../../lib/format.js';
import { statusBadge } from '../../lib/status.js';
import { useToast } from '../../components/Toaster.jsx';
import Button from '../../components/Button.jsx';
import Field from '../../components/Field.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import Modal from '../../components/Modal.jsx';
import WizardSteps from '../../components/user/WizardSteps.jsx';
import DocPreview from '../../components/user/DocPreview.jsx';
import PaymentModal from '../../components/user/PaymentModal.jsx';
import DocumentScanAnimation from '../../components/user/DocumentScanAnimation.jsx';

const DRAFT_KEY = 'printa_print_draft';

const DEFAULT_OPTIONS = {
  colorMode: 'BW',
  paperSize: 'A4',
  sides: 'SINGLE',
  copies: 1,
  pageRange: 'all',
  binding: 'none',
  instructions: '',
};

const COLOR_OPTIONS = [
  { value: 'BW', label: 'Black & White' },
  { value: 'COLOR', label: 'Colour' },
];
const SIDES_OPTIONS = [
  { value: 'SINGLE', label: 'Single-sided' },
  { value: 'DOUBLE', label: 'Double-sided' },
];
const PAPER_OPTIONS = [
  { value: 'A4', label: 'A4' },
  { value: 'A3', label: 'A3' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'LEGAL', label: 'Legal' },
];
const BINDING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'stapled', label: 'Stapled' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'hardcover', label: 'Hardcover' },
];

function Segmented({ label, value, onChange, options, name }) {
  const cols = options.length === 3 ? 'grid-cols-3' : options.length === 4 ? 'grid-cols-4' : 'grid-cols-2';
  return (
    <div>
      <span className="field-label">{label}</span>
      <div
        className={`grid gap-1.5 p-1 bg-paper-sunken rounded-xl border border-line ${cols}`}
        role="group"
        aria-label={label}
      >
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

export default function Print() {
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [doc, setDoc] = useState(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [breakdown, setBreakdown] = useState(null);
  const [calcing, setCalcing] = useState(false);

  const [recent, setRecent] = useState([]);
  // Start truthy so Step 1 shows "Loading…" on first paint instead of flashing
  // the "No documents yet" empty state before the fetch resolves.
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name'
  const [toDelete, setToDelete] = useState(null); // doc pending delete confirmation
  const [deleting, setDeleting] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null); // { name, percent, index, count }

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [restored, setRestored] = useState(false);
  const fileInputRef = useRef(null);

  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const totalPages = estimatePagesFromRange(options.pageRange, doc?.pageCount || 1);
  const maxPages = pricing.maxPagesPerOrder || 500;
  const overLimit = totalPages > maxPages;

  const set = (key) => (value) => setOptions((o) => ({ ...o, [key]: value }));

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('docId');
      url.searchParams.delete('step');
      window.history.replaceState({}, '', url.pathname);
    } catch {
      /* no-op */
    }
  }

  async function loadRecent() {
    setLoadingRecent(true);
    try {
      const data = await api.get('/documents?limit=5');
      setRecent(data.documents || []);
    } catch {
      /* leave empty */
    } finally {
      setLoadingRecent(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/documents/${toDelete.id}`);
      // If the deleted document is the one loaded into the wizard, clear it.
      if (doc?.id === toDelete.id) {
        setDoc(null);
        clearDraft();
      }
      toast('Document deleted', 'success');
      setToDelete(null);
      await loadRecent();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  // Mount: fetch pricing, restore any draft (URL ?docId/?step or localStorage).
  useEffect(() => {
    let cancelled = false;
    // Fetch the recent-documents list immediately (in parallel with pricing) so the
    // "Choose from Uploaded Documents" panel is always populated and never flashes its
    // empty state — including when a restored draft opens Step 2/3 and the user later
    // navigates back to Step 1.
    loadRecent();
    (async () => {
      try {
        const p = await api.get('/settings/pricing');
        if (!cancelled && p?.pricing) setPricing({ ...DEFAULT_PRICING, ...p.pricing });
      } catch {
        /* keep defaults */
      }

      const docIdParam = initialParams.get('docId');
      const stepParam = parseInt(initialParams.get('step'), 10);

      let saved = null;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch {
        /* ignore */
      }

      let docToLoad = null;
      if (docIdParam) {
        try {
          const d = await api.get(`/documents/${docIdParam}`);
          if (d?.document) docToLoad = d.document;
        } catch {
          /* fall through to saved */
        }
      }
      if (!docToLoad && saved?.doc) docToLoad = saved.doc;

      if (cancelled) return;

      if (docToLoad) {
        if (docToLoad.filePath && String(docToLoad.filePath).startsWith('[AUTO_DELETED]')) {
          clearDraft();
          setRestored(true);
          return;
        }
        setDoc(docToLoad);
        if (saved?.options) setOptions((o) => ({ ...o, ...saved.options }));
        const target = Number.isFinite(stepParam) ? stepParam : saved?.step || 2;
        setStep(Math.min(3, Math.max(1, target)));
      }
      setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft + sync URL whenever the meaningful state changes.
  useEffect(() => {
    if (!restored || step >= 4) return;
    if (!doc) {
      clearDraft();
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, doc, options }));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('docId', doc.id);
      url.searchParams.set('step', String(step));
      window.history.replaceState({}, '', url.toString());
    } catch {
      /* no-op */
    }
  }, [restored, step, doc, options]);

  // Live price recalculation via the authenticated backend endpoint (debounced).
  const priceKey = doc
    ? JSON.stringify({
        id: doc.id,
        colorMode: options.colorMode,
        paperSize: options.paperSize,
        sides: options.sides,
        copies: options.copies,
        binding: options.binding,
        totalPages,
      })
    : null;

  useEffect(() => {
    if (!doc || step < 2 || step > 3) return undefined;
    let cancelled = false;
    setCalcing(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.post('/orders/calculate', {
          documentId: doc.id,
          colorMode: options.colorMode,
          paperSize: options.paperSize,
          sides: options.sides,
          copies: options.copies,
          pageRange: options.pageRange,
          binding: options.binding,
          instructions: options.instructions,
          orientation: 'PORTRAIT',
          totalPages,
        });
        if (!cancelled) setBreakdown(data.breakdown);
      } catch {
        /* keep the previous breakdown on transient failures */
      } finally {
        if (!cancelled) setCalcing(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey, step]);

  function goToStep(target) {
    if (target === 2 && !doc) {
      toast('Please upload or select a document first', 'warning');
      return;
    }
    setStep(Math.min(4, Math.max(1, target)));
  }

  function selectDoc(d) {
    setDoc(d);
    setStep(2);
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    let uploaded = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append('document', file);
      setProgress({ name: file.name, percent: 0, index: i + 1, count: files.length });
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await uploadFile('/documents/upload', fd, (percent, loaded, total) =>
          setProgress({ name: file.name, percent, loaded, total, index: i + 1, count: files.length })
        );
        uploaded = res.document; // single-document enforcement: keep only the last
      } catch (err) {
        toast(`Couldn't upload ${file.name}: ${err.message}`, 'error');
      }
    }

    setProgress(null);
    if (uploaded) {
      toast('File uploaded', 'success');
      selectDoc(uploaded);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function resetWizard() {
    clearDraft();
    setDoc(null);
    setOptions(DEFAULT_OPTIONS);
    setBreakdown(null);
    setReceipt(null);
    setStep(1);
    loadRecent();
  }

  function handleConfirmPayment(method) {
    setPaying(true);
    // Simulated processing delay, matching the legacy 1.5s.
    setTimeout(async () => {
      try {
        const res = await api.post('/orders', {
          documentId: doc.id,
          colorMode: options.colorMode,
          paperSize: options.paperSize,
          sides: options.sides,
          copies: options.copies,
          pageRange: options.pageRange,
          binding: options.binding,
          instructions: options.instructions,
          paymentMethod: method,
          totalPages,
        });
        clearDraft();
        setPaymentOpen(false);
        setReceipt(res.order);
        setStep(4);
        toast('Payment successful — order placed!', 'success');
      } catch (err) {
        toast(err.message || 'Payment failed', 'error');
      } finally {
        setPaying(false);
      }
    }, 1500);
  }

  const filteredRecent = recent
    .filter((d) => d.originalName?.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) =>
      sortBy === 'name'
        ? (a.originalName || '').localeCompare(b.originalName || '')
        : new Date(b.createdAt) - new Date(a.createdAt)
    );

  return (
    <div className="max-w-content mx-auto">
      {/* Print Hub hero — light, with the clay 3D printer */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-white to-accent-soft/60 mb-6 shadow-card">
        <div className="relative flex items-center justify-between gap-4 p-6 sm:p-8 min-h-[9rem]">
          <div className="min-w-0 relative z-10 pr-24 sm:pr-0">
            <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink">Print Hub</h1>
            <p className="mt-2 text-sm sm:text-base text-ink-muted max-w-xs sm:max-w-md">
              Smart document print configuration &amp; live price calculator.
            </p>
          </div>
          <img
            src="/illustrations/clay-printer.png"
            alt=""
            aria-hidden="true"
            width={320}
            height={320}
            className="pointer-events-none select-none absolute right-1 sm:right-4 top-1/2 -translate-y-1/2
                       w-28 sm:w-52 lg:w-64 h-auto mix-blend-multiply"
            draggable={false}
          />
        </div>
      </div>

      <div className="card p-4 sm:p-5 mb-6">
        <WizardSteps current={step} onStepClick={(s) => goToStep(s)} />
      </div>

      {/* STEP 1 — Upload */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 1. Upload new document */}
            <div className="card p-5 sm:p-6">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center text-xs font-bold">
                  1
                </span>
                Upload New Document
              </h3>

              {/* Hidden picker, shared by both idle and uploading states */}
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
              />

              {progress ? (
                /* Uploading — creative document-scan animation */
                <div
                  className="mt-4 rounded-2xl border-2 border-accent/30 bg-accent-soft/40 p-6 sm:p-8"
                  role="status"
                  aria-live="polite"
                >
                  <DocumentScanAnimation percent={progress.percent} fileName={progress.name} />

                  <div className="mt-6 max-w-sm mx-auto">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-ink-soft truncate">
                        {progress.count > 1 ? `File ${progress.index} of ${progress.count}` : 'Uploading'}
                      </span>
                      <span className="text-accent font-bold tabular-nums">{progress.percent}%</span>
                    </div>
                    <div className="mt-2 relative h-2 w-full rounded-full bg-white border border-line overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                        style={{ width: `${progress.percent}%` }}
                      />
                      <span className="pointer-events-none absolute inset-y-0 w-2/5 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                    </div>
                    {progress.total ? (
                      <p className="mt-2 text-center text-xs text-ink-muted tabular-nums">
                        {formatFileSize(progress.loaded)} / {formatFileSize(progress.total)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                /* Idle — drag & drop zone */
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                  }}
                  onDrop={onDrop}
                  className={`mt-4 rounded-2xl p-8 sm:p-10 text-center border-2 border-dashed cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? 'border-accent bg-accent-soft scale-[1.01] shadow-card'
                      : 'border-line hover:border-line-strong bg-paper-sunken'
                  }`}
                >
                  <span
                    className={`h-14 w-14 mx-auto rounded-2xl inline-flex items-center justify-center transition-colors ${
                      dragOver ? 'bg-accent text-white animate-float' : 'bg-accent-soft text-accent'
                    }`}
                  >
                    <UploadCloud size={28} />
                  </span>
                  <p className="mt-4 font-display font-semibold text-ink">
                    {dragOver ? 'Drop your files to upload' : 'Drag & drop your files here'}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">or browse files from your device</p>
                  <span className="btn btn-primary mt-4">
                    <FolderOpen size={16} /> Choose Files
                  </span>
                  <p className="mt-3 text-xs text-ink-faint">
                    Supports PDF, DOC, DOCX, PNG, JPG (max 10&nbsp;MB per file)
                  </p>
                </div>
              )}
            </div>

            {/* 2. Or choose from uploaded documents */}
            <div className="card p-5 sm:p-6">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center text-xs font-bold">
                  2
                </span>
                Or Choose from Uploaded Documents
              </h3>

              <div className="mt-4 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your documents"
                    aria-label="Search uploaded documents"
                    className="field-input pl-9"
                  />
                </div>
                <SortMenu value={sortBy} onChange={setSortBy} />
              </div>

              <div className="mt-4">
                {loadingRecent ? (
                  <p className="text-sm text-ink-muted py-8 text-center">Loading…</p>
                ) : filteredRecent.length === 0 ? (
                  <p className="text-sm text-ink-muted py-8 text-center">
                    {recent.length === 0
                      ? 'No documents yet — upload one to get started.'
                      : 'No documents match your search.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {filteredRecent.map((d) => (
                      <DocRow key={d.id} d={d} onSelect={selectDoc} onDelete={setToDelete} />
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-2 pt-3 border-t border-line">
                <Link
                  to="/user/documents"
                  className="text-sm font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-2"
                >
                  <Folder size={16} />
                  View all uploaded documents
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          {/* Need help */}
          <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <span className="h-12 w-12 shrink-0 rounded-2xl bg-accent-soft text-accent inline-flex items-center justify-center">
                <HelpCircle size={26} />
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-ink">Need help getting a clean print?</p>
                <p className="text-sm text-ink-muted">
                  Check paper sizes, binding options, and file tips before you order.
                </p>
              </div>
            </div>
            <Link to="/user/support" className="btn btn-secondary shrink-0 w-full sm:w-auto">
              View guidelines <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* STEP 2 — Options */}
      {step === 2 && doc && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3 space-y-5">
            <div className="card p-5 flex items-center gap-3">
              <FileTypeIcon mimeType={doc.mimeType} size={20} boxed />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink truncate">{doc.originalName}</p>
                <p className="text-xs text-ink-muted">
                  {doc.pageCount ? `${doc.pageCount} pages · ` : ''}
                  {formatFileSize(doc.fileSize)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
                Change
              </Button>
            </div>

            <div className="card p-5 space-y-5">
              <Segmented
                label="Colour"
                value={options.colorMode}
                onChange={set('colorMode')}
                options={COLOR_OPTIONS}
                name="colorMode"
              />
              <Segmented
                label="Sides"
                value={options.sides}
                onChange={set('sides')}
                options={SIDES_OPTIONS}
                name="sides"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  as="select"
                  label="Paper size"
                  value={options.paperSize}
                  onChange={(e) => set('paperSize')(e.target.value)}
                >
                  {PAPER_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Field>
                <Field
                  label="Copies"
                  type="number"
                  min={1}
                  value={options.copies}
                  onChange={(e) => set('copies')(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>

              <Field
                label="Page range"
                value={options.pageRange}
                onChange={(e) => set('pageRange')(e.target.value)}
                hint='Use "all", or ranges like 1-5,8,10-12.'
                placeholder="all"
              />

              <div>
                <span className="field-label">Binding</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BINDING_OPTIONS.map((b) => {
                    const active = options.binding === b.value;
                    const rate = pricing.bindingRates?.[b.value] ?? 0;
                    return (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => set('binding')(b.value)}
                        aria-pressed={active}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-paper-hover'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-ink">{b.label}</span>
                        <span className="block text-xs text-ink-muted">
                          {rate > 0 ? `+ ${formatMoney(rate)}` : 'Free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field
                as="textarea"
                label="Special instructions"
                optional
                rows={3}
                value={options.instructions}
                onChange={(e) => set('instructions')(e.target.value)}
                placeholder="Anything the print desk should know"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => goToStep(1)}>
                <ArrowLeft size={18} /> Back
              </Button>
              <Button variant="primary" onClick={() => goToStep(3)} disabled={overLimit}>
                Review order <ArrowRight size={18} />
              </Button>
            </div>
          </div>

          {/* Preview + live price */}
          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-24">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-sm">Live preview</h3>
                <span className={`badge ${options.colorMode === 'BW' ? 'badge-neutral' : 'badge-accent'}`}>
                  {options.colorMode === 'BW' ? 'B&W' : 'Colour'}
                </span>
              </div>
              <DocPreview
                doc={doc}
                grayscale={options.colorMode === 'BW'}
                onReupload={() => goToStep(1)}
              />
            </div>

            <PriceSummary
              breakdown={breakdown}
              calcing={calcing}
              totalPages={totalPages}
              copies={options.copies}
            />

            {overLimit && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-ink">
                <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
                <span>
                  This order is {totalPages} pages, over the {maxPages}-page limit. Reduce the page
                  range or copies to continue.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3 — Review */}
      {step === 3 && doc && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3 card p-6 space-y-5">
            <h2 className="font-display font-semibold text-lg">Review your order</h2>

            <div className="flex items-center gap-3 pb-4 border-b border-line">
              <FileTypeIcon mimeType={doc.mimeType} size={20} boxed />
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{doc.originalName}</p>
                <p className="text-xs text-ink-muted">
                  {doc.pageCount ? `${doc.pageCount} pages · ` : ''}
                  {formatFileSize(doc.fileSize)}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <SummaryRow label="Colour" value={options.colorMode === 'COLOR' ? 'Full colour' : 'Black & white'} />
              <SummaryRow label="Sides" value={options.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'} />
              <SummaryRow label="Paper" value={options.paperSize} />
              <SummaryRow label="Copies" value={options.copies} />
              <SummaryRow label="Page range" value={options.pageRange || 'all'} />
              <SummaryRow
                label="Binding"
                value={BINDING_OPTIONS.find((b) => b.value === options.binding)?.label || 'None'}
              />
            </dl>

            {options.instructions && (
              <div className="text-sm">
                <dt className="text-ink-muted">Instructions</dt>
                <dd className="mt-1 text-ink whitespace-pre-wrap">{options.instructions}</dd>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="secondary" onClick={() => goToStep(2)}>
                <ArrowLeft size={18} /> Back
              </Button>
              <Button variant="primary" onClick={() => setPaymentOpen(true)} disabled={!breakdown || overLimit}>
                Pay {breakdown ? formatMoney(breakdown.totalAmount) : ''}
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 lg:sticky lg:top-24">
            <PriceSummary
              breakdown={breakdown}
              calcing={calcing}
              totalPages={totalPages}
              copies={options.copies}
            />
          </div>
        </div>
      )}

      {/* STEP 4 — Receipt */}
      {step === 4 && receipt && (
        <div className="max-w-xl mx-auto card p-6 sm:p-8 text-center">
          <span className="h-14 w-14 mx-auto rounded-full bg-success/10 text-success inline-flex items-center justify-center">
            <CheckCircle2 size={30} />
          </span>
          <h2 className="mt-4 font-display font-bold text-2xl tracking-tight">Order placed!</h2>
          <p className="mt-1 text-ink-muted">
            Order code <span className="font-semibold text-ink">{receipt.orderNumber}</span>
          </p>

          <dl className="mt-6 text-left rounded-xl bg-paper-sunken border border-line divide-y divide-line">
            <ReceiptRow label="Document" value={receipt.document?.originalName || 'Uploaded document'} />
            <ReceiptRow
              label="Status"
              value={<span className={`badge ${statusBadge(receipt.orderStatus).badge}`}>{statusBadge(receipt.orderStatus).label}</span>}
            />
            <ReceiptRow
              label="Payment"
              value={`${String(receipt.paymentMethod || '').replace('SIMULATED_', '')} · Paid`}
            />
            <ReceiptRow label="Total paid" value={<strong className="text-accent">{formatMoney(receipt.totalAmount)}</strong>} />
            <ReceiptRow label="Placed" value={formatDateTime(receipt.createdAt)} />
          </dl>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/user/orders" className="btn btn-primary">
              Track my orders
            </Link>
            <button type="button" className="btn btn-secondary" onClick={resetWizard}>
              <Printer size={18} /> Print another
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={breakdown?.totalAmount || 0}
        processing={paying}
        onConfirm={handleConfirmPayment}
      />

      {/* Delete confirmation (from a document's kebab menu) */}
      <Modal
        open={!!toDelete}
        onClose={() => (deleting ? null : setToDelete(null))}
        title="Delete document?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting} loadingText="Deleting…">
              <Trash2 size={16} /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Permanently delete{' '}
          <span className="font-semibold text-ink">{toDelete?.originalName}</span>? This can't be undone.
          Orders you've already placed are unaffected.
        </p>
      </Modal>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-line pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Sort control (funnel button + small popover) for the uploaded-documents list. */
function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const OPTIONS = [
    { value: 'recent', label: 'Most recent' },
    { value: 'name', label: 'Name (A–Z)' },
  ];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-line bg-paper-sunken text-ink-soft hover:bg-paper-hover hover:text-ink transition-colors"
        aria-label="Sort documents"
        aria-expanded={open}
        title="Sort"
      >
        <SlidersHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 card p-1.5 shadow-pop z-20 animate-scale-in origin-top-right">
          <p className="px-3 py-1 text-xs font-semibold text-ink-faint uppercase tracking-wide">Sort by</p>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full px-3 h-9 rounded-lg text-sm font-medium transition-colors ${
                value === o.value ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-paper-hover'
              }`}
            >
              {o.label}
              {value === o.value && <CheckCircle2 size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A row in the uploaded-documents list: file badge, meta, "Select" text-link + kebab menu. */
function DocRow({ d, onSelect, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <li className="flex items-center gap-3 py-3">
      <FileTypeIcon mimeType={d.mimeType} size={18} boxed />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink truncate">{d.originalName}</p>
        <p className="text-xs text-ink-muted">
          {formatFileSize(d.fileSize)} · {d.pageCount ? `${d.pageCount} pages` : '—'} · {formatDate(d.createdAt)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onSelect(d)}
        className="text-sm font-semibold text-accent hover:text-accent-hover shrink-0"
      >
        Select
      </button>

      <div className="relative shrink-0" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:bg-paper-hover hover:text-ink transition-colors"
          aria-label={`More actions for ${d.originalName}`}
          aria-expanded={open}
        >
          <MoreVertical size={17} />
        </button>
        {open && (
          <div className="absolute right-0 mt-1.5 w-40 card p-1.5 shadow-pop z-20 animate-scale-in origin-top-right">
            <a
              href={previewUrl(d.id)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover hover:text-ink"
            >
              <Eye size={16} /> Preview
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect(d);
              }}
              className="flex items-center gap-2.5 w-full px-3 h-9 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover hover:text-ink"
            >
              <Printer size={16} /> Print this
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete(d);
              }}
              className="flex items-center gap-2.5 w-full px-3 h-9 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink text-right break-words">{value}</span>
    </div>
  );
}

function PriceSummary({ breakdown, calcing, totalPages, copies }) {
  const b = breakdown;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold">Price</h3>
        {calcing && <Loader2 size={16} className="text-ink-faint animate-spin" aria-label="Recalculating" />}
      </div>
      <dl className="space-y-2 text-sm">
        <Row label={`Pages (${totalPages} × ${copies} ${copies > 1 ? 'copies' : 'copy'})`} value={b ? formatMoney(b.printCost) : '—'} />
        <Row label={`Rate per page`} value={b ? `${formatMoney(b.effectivePageRate)}/pg` : '—'} muted />
        <Row label="Binding" value={b ? formatMoney(b.bindingCost) : '—'} />
        <Row label="Subtotal" value={b ? formatMoney(b.subtotal) : '—'} />
        <Row label={`GST (${Math.round((b?.taxRate || 0) * 100)}%)`} value={b ? formatMoney(b.tax) : '—'} muted />
        <div className="flex items-baseline justify-between pt-3 mt-1 border-t border-line">
          <dt className="font-display font-semibold text-ink">Total</dt>
          <dd className="font-display font-bold text-2xl text-accent">{b ? formatMoney(b.totalAmount) : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={muted ? 'text-ink-faint' : 'text-ink-muted'}>{label}</dt>
      <dd className={`font-medium ${muted ? 'text-ink-muted' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}
