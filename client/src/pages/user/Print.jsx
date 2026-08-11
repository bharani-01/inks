import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Palette,
  Droplet,
  Layers,
  FileText,
  Smartphone,
  Monitor,
  Sparkles,
  Wallet as WalletIcon,
  Zap,
  Download,
  ShieldCheck,
  QrCode,
  Lock,
  Check,
} from 'lucide-react';
import { api, uploadFile, previewUrl, invoiceUrl } from '../../lib/api.js';
import { DEFAULT_PRICING, estimatePagesFromRange } from '../../lib/pricing.js';
import { formatMoney, formatMoneyIN, formatFileSize, formatDate, formatDateTime } from '../../lib/format.js';
import { statusBadge } from '../../lib/status.js';
import { useToast } from '../../components/Toaster.jsx';
import Button from '../../components/Button.jsx';
import Field from '../../components/Field.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import Modal from '../../components/Modal.jsx';
import WizardSteps from '../../components/user/WizardSteps.jsx';
import DocPreview from '../../components/user/DocPreview.jsx';
import DocumentScanAnimation from '../../components/user/DocumentScanAnimation.jsx';

const DRAFT_KEY = 'printa_print_draft';

const DEFAULT_OPTIONS = {
  colorMode: 'BW',
  paperSize: 'A4',
  sides: 'SINGLE',
  orientation: 'PORTRAIT',
  copies: 1,
  pageRange: 'all',
  binding: 'none',
  instructions: '',
};

const COLOR_OPTIONS = [
  { value: 'BW', label: 'Black & White', icon: Droplet },
  { value: 'COLOR', label: 'Full Colour', icon: Sparkles },
];
const SIDES_OPTIONS = [
  { value: 'SINGLE', label: 'Single-sided', icon: FileText },
  { value: 'DOUBLE', label: 'Double-sided (Duplex)', icon: Layers },
];
const ORIENTATION_OPTIONS = [
  { value: 'PORTRAIT', label: 'Portrait', icon: Smartphone },
  { value: 'LANDSCAPE', label: 'Landscape', icon: Monitor },
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
      <span className="field-label font-bold text-xs uppercase tracking-wider text-ink-muted mb-1.5 block">
        {label}
      </span>
      <div
        className={`grid gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-inner ${cols}`}
        role="group"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              name={name}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 select-none ${
                active
                  ? 'bg-accent text-white shadow-md shadow-accent/30 ring-2 ring-accent/20 scale-[1.01]'
                  : 'text-slate-600 hover:text-ink hover:bg-white/70'
              }`}
            >
              {Icon && <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConfettiCelebration() {
  const particles = useMemo(() => {
    const colors = ['#312E81', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#14B8A6'];
    return Array.from({ length: 42 }).map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: `${(i * 2.38) + (Math.sin(i) * 1.5)}%`,
      top: `${Math.random() * 15}%`,
      size: `${7 + (i % 5) * 2}px`,
      delay: `${(i * 0.04).toFixed(2)}s`,
      duration: `${(1.6 + (i % 4) * 0.3).toFixed(2)}s`,
      rotate: `${(i * 45) % 360}deg`,
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-sm animate-confetti-fall shadow-xs"
          style={{
            backgroundColor: p.color,
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            transform: `rotate(${p.rotate})`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function Print() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [doc, setDoc] = useState(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [breakdown, setBreakdown] = useState(null);
  const [calcing, setCalcing] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState(null);
  const [couponObj, setCouponObj] = useState(null);

  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name'
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [userWallet, setUserWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState('WALLET');
  const [showCelebration, setShowCelebration] = useState(false);

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
      window.history.replaceState({}, '', window.location.pathname);
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

  // Mount: fetch pricing, restore any saved draft from localStorage.
  useEffect(() => {
    let cancelled = false;
    loadRecent();
    (async () => {
      try {
        const p = await api.get('/settings/pricing');
        if (!cancelled && p?.pricing) setPricing({ ...DEFAULT_PRICING, ...p.pricing });
      } catch {
        /* keep defaults */
      }

      let saved = null;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch {
        /* ignore */
      }

      let docToLoad = saved?.doc || null;

      // Clean address bar immediately if any legacy query params existed
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (cancelled) return;

      if (docToLoad) {
        if (docToLoad.filePath && String(docToLoad.filePath).startsWith('[AUTO_DELETED]')) {
          clearDraft();
          setRestored(true);
          return;
        }
        setDoc(docToLoad);
        if (saved?.options) setOptions((o) => ({ ...o, ...saved.options }));
        const target = saved?.step || 2;
        setStep(Math.min(3, Math.max(1, target)));
      }
      setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft in localStorage (keep clean browser URL)
  useEffect(() => {
    if (!restored || step >= 4) return;
    if (!doc) {
      clearDraft();
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, doc, options }));
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
        couponCode: appliedCoupon,
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
          couponCode: appliedCoupon,
          totalPages,
        });
        if (!cancelled) {
          setBreakdown(data.breakdown);
          setCouponError(data.couponError || null);
          setCouponObj(data.coupon || null);
        }
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

  const PHASE1_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    // Check for unsupported Phase 1 files
    const unsupported = files.filter((f) => {
      const ext = ('.' + f.name.split('.').pop()).toLowerCase();
      return !PHASE1_EXTENSIONS.includes(ext) && !f.type.startsWith('image/') && f.type !== 'application/pdf';
    });

    if (unsupported.length > 0) {
      toast('For 100% exact print fidelity, please save your Word/PowerPoint document as a PDF before uploading.', 'error');
      return;
    }

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
      toast('File uploaded successfully', 'success');
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
    setShowCelebration(false);
    setPaymentOpen(false);
    setStep(1);
    loadRecent();
  }

  async function handleOpenPaymentModal() {
    if (!doc || !breakdown) return;
    setPaymentOpen(true);
    setWalletLoading(true);
    try {
      const res = await api.get('/wallet');
      if (res?.wallet) {
        setUserWallet(res.wallet);
      }
    } catch (err) {
      console.error('Failed to load wallet balance:', err);
    } finally {
      setWalletLoading(false);
    }
  }

  async function handlePayWithWallet() {
    if (!doc || !breakdown) return;
    setPaying(true);
    try {
      // 1. Create print order
      const orderRes = await api.post('/orders', {
        documentId: doc.id,
        colorMode: options.colorMode,
        paperSize: options.paperSize,
        sides: options.sides,
        copies: options.copies,
        pageRange: options.pageRange,
        binding: options.binding,
        instructions: options.instructions,
        paymentMethod: 'WALLET',
        couponCode: appliedCoupon && !couponError ? appliedCoupon.trim() : undefined,
        totalPages,
      });

      const orderData = orderRes.order || orderRes;

      // 2. Perform atomic payment from Ink Wallet
      const payRes = await api.post('/wallet/pay', {
        orderId: orderData.id,
      });

      clearDraft();
      setReceipt(payRes.order || orderData);
      setPaymentOpen(false);
      setStep(4);
      setShowCelebration(true);
      toast('Payment successful! Order confirmed for printing.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to process Ink Wallet payment', 'error');
    } finally {
      setPaying(false);
    }
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
        <div className="relative flex items-center justify-between gap-4 p-5 sm:p-7 min-h-[7.5rem] sm:min-h-[8.5rem]">
          <div className="min-w-0 relative z-10 pr-28 sm:pr-40 lg:pr-48">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">Print Hub</h1>
            <p className="mt-1 text-xs sm:text-sm text-ink-muted max-w-xs sm:max-w-md">
              Smart document print configuration &amp; live price calculator.
            </p>
          </div>
          <img
            src="/illustrations/clay-printer.png"
            alt=""
            aria-hidden="true"
            width={200}
            height={200}
            className="pointer-events-none select-none absolute right-3 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2
                       h-[75%] sm:h-[82%] max-h-28 sm:max-h-32 w-auto object-contain mix-blend-multiply drop-shadow-xs"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* 1. Upload new document */}
            <div className="card p-5 sm:p-6 flex flex-col h-full justify-between">
              <div>
                <h3 className="font-display font-semibold flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Upload New Document
                </h3>
              </div>

              {/* Hidden picker, shared by both idle and uploading states */}
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              />

              {progress ? (
                /* Uploading — creative document-scan animation */
                <div
                  className="mt-4 flex-1 min-h-[280px] rounded-2xl border-2 border-accent/30 bg-accent-soft/40 p-6 sm:p-8 flex flex-col items-center justify-center"
                  role="status"
                  aria-live="polite"
                >
                  <DocumentScanAnimation percent={progress.percent} fileName={progress.name} />

                  <div className="mt-6 max-w-sm w-full mx-auto">
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
                  className={`mt-4 flex-1 min-h-[280px] rounded-2xl p-6 sm:p-8 text-center border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                    dragOver
                      ? 'border-accent bg-accent-soft scale-[1.01] shadow-card'
                      : 'border-line hover:border-line-strong bg-paper-sunken'
                  }`}
                >
                  <span
                    className={`h-13 w-13 mx-auto rounded-2xl inline-flex items-center justify-center transition-colors ${
                      dragOver ? 'bg-accent text-white animate-float' : 'bg-accent-soft text-accent'
                    }`}
                  >
                    <UploadCloud size={26} />
                  </span>
                  <p className="mt-3 font-display font-semibold text-ink text-sm sm:text-base">
                    {dragOver ? 'Drop your files to upload' : 'Drag & drop your files here'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">or browse files from your device</p>
                  <span className="btn btn-primary mt-3 text-xs h-9 px-4">
                    <FolderOpen size={15} /> Choose Files
                  </span>
                  <div className="mt-3 space-y-0.5">
                    <p className="text-[11px] font-medium text-ink-soft">
                      Supports PDF, PNG, JPG, WEBP (up to 50&nbsp;MB)
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      Tip: For Word or PowerPoint files, save as PDF for exact print fidelity.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Or choose from uploaded documents */}
            <div className="card p-5 sm:p-6 flex flex-col h-full justify-between">
              <div>
                <h3 className="font-display font-semibold flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  Or Choose from Uploaded Documents
                </h3>

                <div className="mt-4 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search your documents"
                      aria-label="Search uploaded documents"
                      className="field-input pl-9 h-10 text-xs sm:text-sm"
                    />
                  </div>
                  <SortMenu value={sortBy} onChange={setSortBy} />
                </div>
              </div>

              <div className="mt-3 flex-1 flex flex-col justify-start">
                {loadingRecent ? (
                  <p className="text-xs text-ink-muted py-8 text-center">Loading documents…</p>
                ) : filteredRecent.length === 0 ? (
                  <p className="text-xs text-ink-muted py-8 text-center">
                    {recent.length === 0
                      ? 'No documents yet — upload one on the left to get started.'
                      : 'No documents match your search.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-line max-h-[260px] overflow-y-auto pr-1">
                    {filteredRecent.map((d) => (
                      <DocRow key={d.id} d={d} onSelect={selectDoc} onDelete={setToDelete} />
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-line">
                <Link
                  to="/user/documents"
                  className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
                >
                  <Folder size={15} />
                  View all uploaded documents
                  <ChevronRight size={15} />
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
              <Segmented
                label="Orientation"
                value={options.orientation || 'PORTRAIT'}
                onChange={set('orientation')}
                options={ORIENTATION_OPTIONS}
                name="orientation"
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
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              appliedCoupon={appliedCoupon}
              setAppliedCoupon={setAppliedCoupon}
              couponError={couponError}
              couponObj={couponObj}
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
              <SummaryRow label="Orientation" value={options.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} />
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
              <Button
                variant="primary"
                onClick={handleOpenPaymentModal}
                disabled={!breakdown || overLimit}
              >
                <Zap size={16} /> Proceed to Payment ({breakdown ? formatMoney(breakdown.totalAmount) : ''}) &rarr;
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 lg:sticky lg:top-24">
            <PriceSummary
              breakdown={breakdown}
              calcing={calcing}
              totalPages={totalPages}
              copies={options.copies}
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              appliedCoupon={appliedCoupon}
              setAppliedCoupon={setAppliedCoupon}
              couponError={couponError}
              couponObj={couponObj}
            />
          </div>
        </div>
      )}

      {/* STEP 4 — Receipt with Confetti Celebration Animation */}
      {step === 4 && receipt && (
        <div className="max-w-xl mx-auto card p-6 sm:p-10 text-center relative overflow-hidden animate-scale-in">
          {showCelebration && <ConfettiCelebration />}

          <div className="relative z-10 space-y-6">
            {/* Animated Glowing Success Ring */}
            <div className="h-20 w-20 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 animate-glow-pulse">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                <Sparkles size={12} /> Payment Confirmed &amp; Order Placed
              </span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-ink tracking-tight pt-1">
                Printing Preparation Started!
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted">
                Your print order <strong className="font-mono text-accent">#{receipt.orderNumber}</strong> was paid successfully via <strong>Ink Wallet</strong>.
              </p>
            </div>

            <div className="p-5 text-left rounded-2xl bg-paper-sunken border border-line divide-y divide-line text-xs sm:text-sm shadow-2xs space-y-2">
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-muted">Order Number</span>
                <span className="font-mono font-bold text-accent">{receipt.orderNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-muted">Document</span>
                <span className="font-semibold text-ink truncate max-w-[200px]" title={receipt.document?.originalName}>
                  {receipt.document?.originalName || doc?.originalName || 'Document'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-muted">Payment Method</span>
                <span className="font-semibold text-emerald-700">💳 Ink Wallet (Instant)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-ink-muted">Total Paid</span>
                <span className="font-bold text-emerald-700 text-base font-display">{formatMoney(receipt.totalAmount)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={invoiceUrl(receipt.id)}
                download={`Invoice-${receipt.orderNumber}.pdf`}
                className="btn btn-primary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 shadow-sm font-semibold"
              >
                <Download size={15} /> Download Tax Invoice (PDF)
              </a>
              <Link
                to={`/user/orders?track=${receipt.orderNumber}`}
                className="btn btn-secondary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 font-semibold"
              >
                <FileText size={15} /> Track Print Progress
              </Link>
              <button
                type="button"
                onClick={resetWizard}
                className="btn btn-ghost text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold"
              >
                <Printer size={15} /> Print Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT METHODS POPUP MODAL */}
      <Modal
        open={paymentOpen}
        onClose={() => (paying ? null : setPaymentOpen(false))}
        title="Select Payment Method"
        size="md"
      >
        <div className="space-y-4 pt-1">
          {/* Order summary mini-card */}
          <div className="p-3.5 rounded-2xl bg-paper-sunken border border-line flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-ink truncate max-w-[240px]">{doc?.originalName}</p>
              <p className="text-[11px] text-ink-muted">
                {totalPages} {totalPages === 1 ? 'page' : 'pages'} · {options.copies} {options.copies > 1 ? 'copies' : 'copy'} · {options.colorMode === 'COLOR' ? 'Colour' : 'B&W'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">Total Payable</span>
              <span className="text-lg font-bold text-accent font-display">
                {breakdown ? formatMoney(breakdown.totalAmount) : '—'}
              </span>
            </div>
          </div>

          {/* Payment options */}
          <div className="space-y-3">
            {/* Option 1: Ink Wallet */}
            <div
              onClick={() => setSelectedPayMethod('WALLET')}
              role="button"
              tabIndex={0}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                selectedPayMethod === 'WALLET'
                  ? 'border-accent bg-accent-soft/30 ring-2 ring-accent/20 shadow-sm'
                  : 'border-line bg-white hover:bg-paper-hover'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedPayMethod === 'WALLET' ? 'bg-accent text-white' : 'bg-paper-hover text-ink-soft'
                    }`}
                  >
                    <WalletIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">Ink Wallet</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Instant 1-Click
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Available Balance:{' '}
                      <strong className={userWallet && userWallet.balance >= (breakdown?.totalAmount || 0) ? 'text-emerald-700' : 'text-rose-600'}>
                        {walletLoading ? '...' : formatMoneyIN(userWallet?.balance || 0)}
                      </strong>
                    </p>
                  </div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedPayMethod === 'WALLET' ? 'border-accent bg-accent text-white' : 'border-line'
                  }`}
                >
                  {selectedPayMethod === 'WALLET' && <Check size={12} strokeWidth={3} />}
                </div>
              </div>

              {/* Balance breakdown / CTA if selected */}
              {selectedPayMethod === 'WALLET' && (
                <div className="mt-3.5 pt-3 border-t border-line/70">
                  {userWallet && userWallet.balance >= (breakdown?.totalAmount || 0) ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-ink-soft">
                        <span>Balance after payment:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatMoneyIN(userWallet.balance - (breakdown?.totalAmount || 0))}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handlePayWithWallet}
                        disabled={paying}
                        className="btn btn-primary text-xs sm:text-sm w-full py-3 inline-flex items-center justify-center gap-2 shadow-sm font-bold"
                      >
                        {paying ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Processing Payment...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={16} />
                            <span>Pay {breakdown ? formatMoney(breakdown.totalAmount) : ''} from Ink Wallet</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-950">Insufficient Balance</span>
                          <p className="mt-0.5 text-[11px] text-amber-800">
                            You need{' '}
                            <strong>
                              {formatMoney(Math.max(0, (breakdown?.totalAmount || 0) - (userWallet?.balance || 0)))}
                            </strong>{' '}
                            more. Please ask your store administrator to top up your balance.
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/user/wallet"
                        className="btn btn-secondary text-xs w-full py-2.5 inline-flex items-center justify-center gap-2"
                      >
                        <WalletIcon size={14} /> View Ink Wallet
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Option 2: UPI / QR Code (Paused by Admin) */}
            <div
              onClick={() => setSelectedPayMethod('UPI')}
              role="button"
              tabIndex={0}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                selectedPayMethod === 'UPI'
                  ? 'border-line bg-paper-sunken/80 ring-1 ring-line shadow-2xs'
                  : 'border-line bg-paper-sunken/40 hover:bg-paper-sunken'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink/70">UPI QR &amp; Apps</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1">
                        <Lock size={10} /> Paused by Admin
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">Google Pay, PhonePe, Paytm, CRED &amp; BHIM</p>
                  </div>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedPayMethod === 'UPI' ? 'border-accent bg-accent text-white' : 'border-line'
                  }`}
                >
                  {selectedPayMethod === 'UPI' && <Check size={12} strokeWidth={3} />}
                </div>
              </div>

              {selectedPayMethod === 'UPI' && (
                <div className="mt-3 pt-3 border-t border-line text-xs text-slate-600 bg-white/60 p-3 rounded-xl">
                  <p className="flex items-center gap-1.5 font-medium text-amber-900">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span>Direct UPI &amp; QR payment gateway is temporarily disabled by administrator.</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Please use your <strong>Ink Wallet</strong> balance above to complete your print order instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

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

function PriceSummary({ breakdown, calcing, totalPages, copies, couponInput, setCouponInput, appliedCoupon, setAppliedCoupon, couponError, couponObj }) {
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
        {b?.discountAmount > 0 && (
          <Row label="Discount" value={`-${formatMoney(b.discountAmount)}`} />
        )}
        <Row label={`GST (${Math.round((b?.taxRate || 0) * 100)}%)`} value={b ? formatMoney(b.tax) : '—'} muted />
        <div className="flex items-baseline justify-between pt-3 mt-1 border-t border-line">
          <dt className="font-display font-semibold text-ink">Total</dt>
          <dd className="font-display font-bold text-2xl text-accent">{b ? formatMoney(b.totalAmount) : '—'}</dd>
        </div>
      </dl>

      <div className="mt-5 pt-4 border-t border-line">
        <label className="text-sm font-medium text-ink block mb-2">Have a coupon code?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Enter code"
            className="field-input flex-1 uppercase"
            disabled={!!appliedCoupon && !couponError}
          />
          {appliedCoupon && !couponError ? (
            <button
              type="button"
              onClick={() => { setAppliedCoupon(''); setCouponInput(''); }}
              className="btn btn-secondary"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAppliedCoupon(couponInput)}
              className="btn btn-primary"
              disabled={!couponInput.trim()}
            >
              Apply
            </button>
          )}
        </div>
        {couponError && <p className="text-xs text-danger mt-2">{couponError}</p>}
        {appliedCoupon && !couponError && couponObj && (
          <p className="text-xs text-success mt-2">Coupon applied successfully!</p>
        )}
      </div>
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
