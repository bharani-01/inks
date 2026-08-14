import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  ShoppingBag,
  Grid,
} from 'lucide-react';
import { api, uploadFile, previewUrl, invoiceUrl, batchInvoiceUrl } from '../../lib/api.js';
import { DEFAULT_PRICING, estimatePagesFromRange } from '../../lib/pricing.js';
import { formatMoney, formatMoneyIN, formatFileSize, formatDate, formatDateTime, updateGlobalWalletBalance } from '../../lib/format.js';
import { statusBadge } from '../../lib/status.js';
import { useToast } from '../../components/Toaster.jsx';
import { useCart } from '../../context/CartContext.jsx';
import Button from '../../components/Button.jsx';
import Field from '../../components/Field.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import Modal from '../../components/Modal.jsx';
import WizardSteps from '../../components/user/WizardSteps.jsx';
import DocPreview from '../../components/user/DocPreview.jsx';
import DocumentScanAnimation from '../../components/user/DocumentScanAnimation.jsx';
import LottiePlayer from '../../components/LottiePlayer.jsx';
import VisualPageSelectorModal from '../../components/user/VisualPageSelectorModal.jsx';

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

export default function Print() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const {
    addToCart,
    cartItemCount,
    setIsOpen,
    editingCartItemId,
    updateCartItem,
    cancelEditingCartItem,
    cartItems,
  } = useCart();

  const [step, setStep] = useState(1);
  const [docs, setDocs] = useState([]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  const doc = docs[activeDocIndex] || docs[0] || null;
  const options = doc?.options || DEFAULT_OPTIONS;

  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showVisualPageModal, setShowVisualPageModal] = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);

  const hasMoreOptionsSet = useMemo(() => {
    return Boolean(
      (options.pageRange && options.pageRange !== 'all') ||
      (options.binding && options.binding !== 'none') ||
      (options.instructions && options.instructions.trim() !== '')
    );
  }, [options.pageRange, options.binding, options.instructions]);

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
  const [touchStart, setTouchStart] = useState(null);

  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const totalPages = docs.reduce((sum, d) => {
    const opts = d.options || DEFAULT_OPTIONS;
    return sum + estimatePagesFromRange(opts.pageRange, d.pageCount || 1);
  }, 0);
  const maxPages = pricing.maxPagesPerOrder || 500;
  const overLimit = totalPages > maxPages;

  function setOptionForActive(key, value) {
    setDocs((prevDocs) => {
      return prevDocs.map((d, idx) => {
        if (idx === activeDocIndex) {
          return {
            ...d,
            options: {
              ...(d.options || DEFAULT_OPTIONS),
              [key]: value,
            },
          };
        }
        return d;
      });
    });
  }

  const set = (key) => (value) => setOptionForActive(key, value);

  function applyOptionsToAll() {
    if (!doc) return;
    const currentOpts = doc.options || DEFAULT_OPTIONS;
    setDocs((prevDocs) =>
      prevDocs.map((d) => ({
        ...d,
        options: { ...currentOpts },
      }))
    );
    toast('Applied current print settings to all documents in batch', 'success');
  }

  function handleTouchStart(e) {
    if (e.targetTouches?.length) setTouchStart(e.targetTouches[0].clientX);
  }

  function handleTouchEnd(e) {
    if (touchStart === null || !e.changedTouches?.length) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 50 && activeDocIndex < docs.length - 1) {
      setActiveDocIndex((idx) => idx + 1);
    } else if (diff < -50 && activeDocIndex > 0) {
      setActiveDocIndex((idx) => idx - 1);
    }
    setTouchStart(null);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDocs([]);
    setActiveDocIndex(0);
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      /* no-op */
    }
  }

  async function loadRecent() {
    setLoadingRecent(true);
    try {
      const data = await api.get('/documents?limit=20');
      const validFetchedDocs = (data.documents || []).filter(
        (d) => !d.filePath || !String(d.filePath).startsWith('[AUTO_DELETED]')
      );
      setRecent(validFetchedDocs);

      // Purge any auto-deleted/abandoned documents from active batch state
      setDocs((prevDocs) => {
        if (!prevDocs.length) return prevDocs;
        const validIds = new Set(validFetchedDocs.map((d) => d.id));
        const filtered = prevDocs.filter(
          (d) => (!d.id || validIds.has(d.id)) && (!d.filePath || !String(d.filePath).startsWith('[AUTO_DELETED]'))
        );
        if (filtered.length < prevDocs.length) {
          if (filtered.length === 0) setStep(1);
          return filtered;
        }
        return prevDocs;
      });
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
      setDocs((prev) => prev.filter((d) => d.id !== toDelete.id));
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

      let savedDocs = saved?.docs || (saved?.doc ? [saved.doc] : []);

      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (cancelled) return;

      if (savedDocs.length > 0) {
        const validDocs = savedDocs
          .filter((d) => !d.filePath || !String(d.filePath).startsWith('[AUTO_DELETED]'))
          .map((d) => ({ ...d, options: d.options || DEFAULT_OPTIONS }));

        if (validDocs.length > 0) {
          setDocs(validDocs);
          const savedIndex = saved?.activeDocIndex || 0;
          setActiveDocIndex(savedIndex < validDocs.length ? savedIndex : 0);
          const target = saved?.step || 2;
          setStep(Math.min(3, Math.max(1, target)));
        } else {
          clearDraft();
        }
      }
      setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronize editing cart item if navigated from cart drawer or /user/cart page
  useEffect(() => {
    const editItem =
      location.state?.editCartItem ||
      (editingCartItemId ? cartItems.find((i) => i.id === editingCartItemId) : null);
    if (editItem && editItem.doc) {
      setDocs([{ ...editItem.doc, options: { ...DEFAULT_OPTIONS, ...editItem.options } }]);
      setActiveDocIndex(0);
      if (editItem.breakdown) setBreakdown(editItem.breakdown);
      setStep(2);
      setRestored(true);
    }
  }, [location.state, editingCartItemId]);

  // Persist draft in localStorage
  useEffect(() => {
    if (!restored || step >= 4) return;
    if (!docs.length) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, docs, activeDocIndex }));
  }, [restored, step, docs, activeDocIndex]);

  // Live price recalculation for ALL documents in batch via backend endpoint
  const priceKey = docs.length > 0
    ? JSON.stringify(
        docs.map((d) => ({
          id: d.id,
          options: d.options || DEFAULT_OPTIONS,
          pages: estimatePagesFromRange(d.options?.pageRange, d.pageCount || 1),
        }))
      ) + appliedCoupon
    : null;

  useEffect(() => {
    if (!docs.length || step < 2 || step > 3) return undefined;
    let cancelled = false;
    setCalcing(true);
    const t = setTimeout(async () => {
      try {
        const promises = docs.map((d) => {
          const opts = d.options || DEFAULT_OPTIONS;
          const pages = estimatePagesFromRange(opts.pageRange, d.pageCount || 1);
          return api.post('/orders/calculate', {
            documentId: d.id,
            colorMode: opts.colorMode,
            paperSize: opts.paperSize,
            sides: opts.sides,
            copies: opts.copies,
            pageRange: opts.pageRange,
            binding: opts.binding,
            instructions: opts.instructions,
            orientation: 'PORTRAIT',
            couponCode: appliedCoupon,
            totalPages: pages,
          });
        });

        const results = await Promise.all(promises);
        if (!cancelled) {
          const combined = results.reduce(
            (acc, res) => {
              const b = res.breakdown;
              if (!b) return acc;
              return {
                printCost: Math.round((acc.printCost + (b.printCost || 0)) * 100) / 100,
                bindingCost: Math.round((acc.bindingCost + (b.bindingCost || 0)) * 100) / 100,
                subtotal: Math.round((acc.subtotal + (b.subtotal || 0)) * 100) / 100,
                discountAmount: Math.round((acc.discountAmount + (b.discountAmount || 0)) * 100) / 100,
                taxRate: b.taxRate !== undefined ? b.taxRate : acc.taxRate,
                tax: Math.round((acc.tax + (b.tax || 0)) * 100) / 100,
                totalAmount: Math.round((acc.totalAmount + (b.totalAmount || 0)) * 100) / 100,
              };
            },
            {
              printCost: 0,
              bindingCost: 0,
              subtotal: 0,
              discountAmount: 0,
              taxRate: 0,
              tax: 0,
              totalAmount: 0,
            }
          );

          const totalBatchPages = docs.reduce((sum, d) => {
            const opts = d.options || DEFAULT_OPTIONS;
            return sum + estimatePagesFromRange(opts.pageRange, d.pageCount || 1);
          }, 0);

          combined.effectivePageRate =
            totalBatchPages > 0 ? Math.round((combined.printCost / totalBatchPages) * 100) / 100 : 0;

          setBreakdown(combined);
          setCouponError(results[0]?.couponError || null);
          setCouponObj(results[0]?.coupon || null);
        }
      } catch {
        /* keep previous breakdown on transient failures */
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
    if (target === 2 && !docs.length) {
      toast('Please upload or select at least one document first', 'warning');
      return;
    }
    setStep(Math.min(4, Math.max(1, target)));
  }

  function selectDoc(d) {
    const maxFilesLimit = pricing?.maxBatchFiles || 20;
    if (docs.length >= maxFilesLimit && !docs.some((item) => item.id === d.id)) {
      toast(`Maximum limit of ${maxFilesLimit} files per batch order reached.`, 'warning');
      return;
    }
    setDocs((prev) => {
      const idx = prev.findIndex((item) => item.id === d.id);
      if (idx !== -1) {
        setActiveDocIndex(idx);
        return prev;
      }
      setActiveDocIndex(prev.length);
      return [...prev, { ...d, options: { ...DEFAULT_OPTIONS } }];
    });
    setStep(2);
  }

  function removeDocFromBatch(id) {
    setDocs((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (next.length === 0) setStep(1);
      return next;
    });
    setActiveDocIndex(0);
  }

  function clearAllBatchDocs() {
    setDocs([]);
    setActiveDocIndex(0);
    clearDraft();
    setStep(1);
    toast('Cleared all documents from batch', 'info');
  }

  const PHASE1_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

  async function handleFiles(fileList) {
    const rawFiles = Array.from(fileList || []);
    if (!rawFiles.length) return;

    const maxFilesLimit = pricing?.maxBatchFiles || 20;
    if (docs.length >= maxFilesLimit) {
      toast(`Maximum limit of ${maxFilesLimit} files per batch reached. Remove files to add more.`, 'warning');
      return;
    }

    let files = rawFiles;
    if (docs.length + rawFiles.length > maxFilesLimit) {
      const allowedCount = maxFilesLimit - docs.length;
      files = rawFiles.slice(0, allowedCount);
      toast(`Maximum limit is ${maxFilesLimit} files per batch. ${rawFiles.length - allowedCount} file(s) were trimmed.`, 'warning');
    }

    // Check for unsupported Phase 1 files
    const unsupported = files.filter((f) => {
      const ext = ('.' + f.name.split('.').pop()).toLowerCase();
      return !PHASE1_EXTENSIONS.includes(ext) && !f.type.startsWith('image/') && f.type !== 'application/pdf';
    });

    if (unsupported.length > 0) {
      toast('For 100% exact print fidelity, please save your Word/PowerPoint document as a PDF before uploading.', 'error');
      return;
    }

    const newUploaded = [];
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
        if (res?.document) {
          newUploaded.push({
            ...res.document,
            options: { ...DEFAULT_OPTIONS },
          });
        }
      } catch (err) {
        toast(`Couldn't upload ${file.name}: ${err.message}`, 'error');
      }
    }

    setProgress(null);
    if (newUploaded.length > 0) {
      toast(`${newUploaded.length} file(s) uploaded successfully`, 'success');
      setDocs((prev) => {
        const next = [...prev, ...newUploaded];
        setActiveDocIndex(prev.length);
        return next;
      });
      setStep(2);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function resetWizard() {
    clearDraft();
    cancelEditingCartItem();
    setDocs([]);
    setActiveDocIndex(0);
    setBreakdown(null);
    setReceipt(null);
    setShowCelebration(false);
    setPaymentOpen(false);
    setStep(1);
    loadRecent();
  }

  function handleCancelEdit() {
    cancelEditingCartItem();
    resetWizard();
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
    if (!docs.length || !breakdown) return;
    setPaying(true);
    try {
      if (docs.length === 1) {
        const d = docs[0];
        const opts = d.options || DEFAULT_OPTIONS;
        const estPages = estimatePagesFromRange(opts.pageRange, d.pageCount || 1);
        const orderRes = await api.post('/orders', {
          documentId: d.id,
          colorMode: opts.colorMode,
          paperSize: opts.paperSize,
          sides: opts.sides,
          copies: opts.copies,
          pageRange: opts.pageRange,
          binding: opts.binding,
          instructions: opts.instructions,
          paymentMethod: 'WALLET',
          couponCode: appliedCoupon && !couponError ? appliedCoupon.trim() : undefined,
          totalPages: estPages,
        });

        const orderData = orderRes.order || orderRes;
        const payRes = await api.post('/wallet/pay', { orderId: orderData.id });
        clearDraft();
        if (payRes?.balanceAfter !== undefined) updateGlobalWalletBalance(payRes.balanceAfter);
        setReceipt(payRes.order || orderData);
      } else {
        const batchItems = docs.map((d) => {
          const opts = d.options || DEFAULT_OPTIONS;
          const estPages = estimatePagesFromRange(opts.pageRange, d.pageCount || 1);
          return {
            documentId: d.id,
            colorMode: opts.colorMode,
            paperSize: opts.paperSize,
            sides: opts.sides,
            copies: opts.copies,
            pageRange: opts.pageRange,
            binding: opts.binding,
            instructions: opts.instructions,
            totalPages: estPages,
          };
        });

        const batchRes = await api.post('/batch-orders', {
          items: batchItems,
          paymentMethod: 'WALLET',
          couponCode: appliedCoupon && !couponError ? appliedCoupon.trim() : undefined,
        });

        const batchData = batchRes.batchOrder || batchRes;
        const payRes = await api.post('/wallet/pay-batch', { batchOrderId: batchData.id });
        clearDraft();
        if (payRes?.balanceAfter !== undefined) updateGlobalWalletBalance(payRes.balanceAfter);
        setReceipt({
          ...batchData,
          ...(payRes.batch || payRes.batchOrder || {}),
          orders: (payRes.orders && payRes.orders.length > 0) ? payRes.orders : (batchData.orders || []),
        });
      }

      setPaymentOpen(false);
      setStep(4);
      setShowCelebration(true);
      toast('Payment successful! All orders confirmed for printing.', 'success');
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
        <div className="relative flex items-center justify-between gap-4 p-6 sm:p-7 min-h-[8.5rem] sm:min-h-[9.5rem]">
          <div className="min-w-0 relative z-10 pr-32 sm:pr-48 lg:pr-56">
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">Print Hub</h1>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-ink-muted max-w-xs sm:max-w-md">
              Smart document print configuration &amp; live price calculator.
            </p>
          </div>
          <img
            src="/illustrations/clay-printer.webp"
            alt=""
            aria-hidden="true"
            width={260}
            height={260}
            className="pointer-events-none select-none absolute right-2 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2
                       w-32 sm:w-44 lg:w-52 h-auto max-h-[88%] object-contain mix-blend-multiply drop-shadow-xs"
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
          <div className="max-w-2xl mx-auto w-full">
            {/* 1. Upload new document */}
            <div className="card p-5 sm:p-6 flex flex-col justify-between">
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
                multiple
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
                  <p className="mt-0.5 text-xs text-ink-muted">or browse multiple files from your device</p>
                  <span className="btn btn-primary mt-3 text-xs h-9 px-4">
                    <FolderOpen size={15} /> Choose Files
                  </span>
                  <div className="mt-3 space-y-0.5">
                    <p className="text-[11px] font-medium text-ink-soft">
                      Supports PDF, PNG, JPG, WEBP (up to 50&nbsp;MB)
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      Tip: Select multiple files at once or drag &amp; drop a batch.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Documents Batch Confirmation Card */}
          {docs.length > 0 && (
            <div className="card p-5 sm:p-6 space-y-4 border border-line bg-white shadow-sm rounded-2xl animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200/60">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-ink">
                      {docs.length} Document{docs.length > 1 ? 's' : ''} Selected for Printing
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Review your batch below, add more files, or clear all before setting options.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={clearAllBatchDocs}
                    className="btn bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs h-9 px-3.5 rounded-xl border border-red-200/80 flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Clear all documents from batch"
                  >
                    <Trash2 size={14} />
                    <span>Clear All</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs h-9 px-3.5 rounded-xl border border-line flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <UploadCloud size={14} />
                    <span>+ Add Files</span>
                  </button>
                </div>
              </div>

              {/* File Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {docs.map((d, index) => (
                  <div
                    key={d.id || index}
                    className="p-3 rounded-2xl bg-slate-50/70 border border-line hover:border-emerald-500/50 hover:bg-white transition-all flex items-center justify-between gap-3 group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeIcon mimeType={d.mimeType} size={18} boxed />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-xs truncate">{d.originalName}</p>
                        <p className="text-[11px] text-ink-muted">
                          {d.pageCount ? `${d.pageCount} pages · ` : ''}
                          {formatFileSize(d.fileSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocFromBatch(d.id)}
                      className="h-8 w-8 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                      title="Remove document from batch"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Confirmation Action Button */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="text-xs text-ink-muted font-medium">
                  Total Batch:{' '}
                  <span className="font-bold text-ink">
                    {docs.reduce((sum, d) => sum + (d.pageCount || 1), 0)} Pages
                  </span>{' '}
                  across <span className="font-bold text-ink">{docs.length} File{docs.length > 1 ? 's' : ''}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveDocIndex(0);
                    setStep(2);
                  }}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 px-6 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <span>Confirm &amp; Continue to Print Options ({docs.length} File{docs.length > 1 ? 's' : ''})</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

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
        <div className="space-y-6">
          {/* Active Cart Edit Alert Banner */}
          {editingCartItemId && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-accent-soft/80 to-emerald-50 border border-accent/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <SlidersHorizontal size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm font-bold text-ink truncate">
                      Editing Print Options for Cart Item: <span className="text-accent">{doc.originalName}</span>
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white uppercase tracking-wider shrink-0">
                      Edit Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    Modify color, orientation, sides, copies, or page range below, then click "Save &amp; Update Cart".
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn btn-secondary text-xs h-9 px-3.5 shrink-0 self-start sm:self-auto"
              >
                Cancel Edit
              </button>
            </div>
          )}



          {/* Top Row: Document Preview (Left) and Print Options (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Document Preview */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
              <div className="space-y-3">
                <DocPreview
                  doc={doc}
                  grayscale={options.colorMode === 'BW'}
                  orientation={options.orientation || 'PORTRAIT'}
                  pageRange={options.pageRange}
                  onPageRangeChange={(newRange) => set('pageRange')(newRange)}
                  onReupload={() => goToStep(1)}
                  onDelete={(id) => removeDocFromBatch(id)}
                />

                {/* Smart Multi-Document Carousel Navigation */}
                {docs.length > 1 && (
                  <div className="flex flex-col items-center justify-center pt-2 space-y-2 select-none">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveDocIndex((idx) => Math.max(0, idx - 1))}
                        disabled={activeDocIndex <= 0}
                        className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-20 text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Previous Document"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {/* Interactive Quick Jump Dropdown Badge */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowDocDropdown((v) => !v)}
                          className="px-3.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs shadow-md tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Click to switch file"
                        >
                          <span>{activeDocIndex + 1}/{docs.length}</span>
                          <ChevronDown size={13} className={`transition-transform duration-200 ${showDocDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showDocDropdown && (
                          <div className="absolute top-full left-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-64 max-w-[85vw] max-h-60 bg-white rounded-2xl shadow-2xl border border-line p-2 z-50 overflow-y-auto animate-scale-in">
                            <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-2 py-1 border-b border-line">
                              Select Batch File ({docs.length})
                            </p>
                            <div className="space-y-0.5 mt-1">
                              {docs.map((d, idx) => (
                                <button
                                  key={d.id || idx}
                                  type="button"
                                  onClick={() => {
                                    setActiveDocIndex(idx);
                                    setShowDocDropdown(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                    idx === activeDocIndex
                                      ? 'bg-accent-soft text-accent font-bold'
                                      : 'hover:bg-paper-hover text-ink font-medium'
                                  }`}
                                >
                                  <span className="truncate min-w-0">{idx + 1}. {d.originalName}</span>
                                  {idx === activeDocIndex && <Check size={14} className="shrink-0 text-accent" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveDocIndex((idx) => Math.min(docs.length - 1, idx + 1))}
                        disabled={activeDocIndex >= docs.length - 1}
                        className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-20 text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Next Document"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Windowed Dots Row (Renders max 5 dots to prevent overflow for 20+ files) */}
                    <div className="flex items-center gap-1.5">
                      {docs.length <= 7 ? (
                        docs.map((d, idx) => (
                          <button
                            key={d.id || idx}
                            type="button"
                            onClick={() => setActiveDocIndex(idx)}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                              idx === activeDocIndex ? 'w-5 bg-slate-800' : 'w-2 bg-slate-300 hover:bg-slate-400'
                            }`}
                            title={`Switch to file ${idx + 1}`}
                          />
                        ))
                      ) : (
                        Array.from({ length: Math.min(5, docs.length) }, (_, i) => {
                          let targetIndex = activeDocIndex - 2 + i;
                          if (targetIndex < 0) targetIndex = i;
                          if (targetIndex >= docs.length) targetIndex = docs.length - 5 + i;
                          const isActive = targetIndex === activeDocIndex;
                          return (
                            <button
                              key={targetIndex}
                              type="button"
                              onClick={() => setActiveDocIndex(targetIndex)}
                              className={`h-2 rounded-full transition-all cursor-pointer ${
                                isActive ? 'w-5 bg-accent' : 'w-2 bg-slate-300 hover:bg-slate-400'
                              }`}
                              title={`Switch to file ${targetIndex + 1}`}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Single Unified Print Configuration Card */}
            <div className="lg:col-span-7">
              <div className="card p-5 sm:p-6 space-y-5 border border-line bg-white shadow-sm rounded-2xl">
                {/* 1. Document Title & Batch Controls Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-line">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileTypeIcon mimeType={doc.mimeType} size={20} boxed />
                    <div className="min-w-0">
                      <p className="font-bold text-ink text-xs sm:text-sm truncate">{doc.originalName}</p>
                      <p className="text-[11px] text-ink-muted">
                        {doc.pageCount ? `${doc.pageCount} pages · ` : ''}
                        {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {docs.length > 1 && (
                      <button
                        type="button"
                        onClick={applyOptionsToAll}
                        className="btn btn-secondary text-[11px] h-8 px-2.5 font-semibold text-accent"
                        title="Apply these print options to all documents in your batch"
                      >
                        <Sparkles size={12} /> Apply to All ({docs.length})
                      </button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => goToStep(1)} className="text-xs h-8 px-2.5">
                      + Add / Batch
                    </Button>
                  </div>
                </div>

                {/* 2. Copies Stepper */}
                <div className="flex items-center justify-between py-0.5">
                  <div>
                    <span className="text-xs font-bold text-ink block">Number of copies</span>
                    <span className="text-[11px] text-ink-muted">How many sets to print</span>
                  </div>
                  <div className="flex items-center bg-slate-900 text-white rounded-xl px-3 py-1 shadow-2xs transition-all">
                    <button
                      type="button"
                      onClick={() => set('copies')(Math.max(1, (options.copies || 1) - 1))}
                      disabled={options.copies <= 1}
                      className="w-5 h-5 flex items-center justify-center text-sm font-bold hover:bg-white/20 rounded transition-colors disabled:opacity-40"
                      aria-label="Decrease copies"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-xs font-bold select-none">
                      {options.copies || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => set('copies')((options.copies || 1) + 1)}
                      className="w-5 h-5 flex items-center justify-center text-sm font-bold hover:bg-white/20 rounded transition-colors"
                      aria-label="Increase copies"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="border-t border-line" />

                {/* 3. Primary Print Options */}
                {/* Choose print color */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-ink text-xs block">Choose print color</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Coloured Card */}
                    <button
                      type="button"
                      onClick={() => set('colorMode')('COLOR')}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        options.colorMode === 'COLOR'
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                          : 'border border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <circle cx="12" cy="8" r="5.5" fill="#EC4899" fillOpacity="0.9" />
                        <circle cx="8.5" cy="14.5" r="5.5" fill="#06B6D4" fillOpacity="0.9" />
                        <circle cx="15.5" cy="14.5" r="5.5" fill="#FBBF24" fillOpacity="0.9" />
                      </svg>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-xs">Coloured</p>
                        <p className="text-[11px] text-ink-muted">₹{pricing.colorRate ?? 10}/page</p>
                      </div>
                    </button>

                    {/* B & W Card */}
                    <button
                      type="button"
                      onClick={() => set('colorMode')('BW')}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        options.colorMode === 'BW'
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                          : 'border border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <circle cx="12" cy="8" r="5.5" fill="#1E293B" fillOpacity="0.95" />
                        <circle cx="8.5" cy="14.5" r="5.5" fill="#64748B" fillOpacity="0.9" />
                        <circle cx="15.5" cy="14.5" r="5.5" fill="#CBD5E1" fillOpacity="0.9" />
                      </svg>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-xs">B &amp; W</p>
                        <p className="text-[11px] text-ink-muted">₹{pricing.bwRate ?? 2}/page</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Choose print orientation */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-ink text-xs block">Choose print orientation</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Portrait */}
                    <button
                      type="button"
                      onClick={() => set('orientation')('PORTRAIT')}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        (options.orientation || 'PORTRAIT') === 'PORTRAIT'
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                          : 'border border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                        <div className="w-3 h-4 border border-white rounded-[2px] flex items-center justify-center">
                          <span className="w-1.5 h-0.5 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-xs">Portrait</p>
                        <p className="text-[11px] text-ink-muted">8.3 × 11.7 in</p>
                      </div>
                    </button>

                    {/* Landscape */}
                    <button
                      type="button"
                      onClick={() => set('orientation')('LANDSCAPE')}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        options.orientation === 'LANDSCAPE'
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                          : 'border border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                        <div className="w-4 h-3 border border-white rounded-[2px] flex items-center justify-center">
                          <span className="w-2 h-0.5 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-xs">Landscape</p>
                        <p className="text-[11px] text-ink-muted">11.7 × 8.3 in</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Choose print sides */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-ink text-xs block">Choose print sides</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Single-sided */}
                    <button
                      type="button"
                      onClick={() => set('sides')('SINGLE')}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        options.sides === 'SINGLE'
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                          : 'border border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-line">
                        <FileText size={14} className="text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-xs">Single-sided</p>
                        <p className="text-[11px] text-ink-muted">1 side per sheet</p>
                      </div>
                    </button>

                    {/* Double-sided (Duplex) */}
                    <button
                      type="button"
                      onClick={() => set('sides')('DOUBLE')}
                      className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                        options.sides === 'DOUBLE'
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                          : 'border border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-line">
                        <Layers size={14} className="text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-xs">Double-sided (Duplex)</p>
                        <p className="text-[11px] text-indigo-700 font-medium">Save paper · 10% OFF</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Paper Size */}
                <div>
                  <label className="font-semibold text-ink text-xs block mb-1">Paper size</label>
                  <select
                    value={options.paperSize}
                    onChange={(e) => set('paperSize')(e.target.value)}
                    className="field-input w-full text-xs h-10 bg-white"
                  >
                    {PAPER_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Integrated More Options Accordion */}
                <div className="pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions((prev) => !prev)}
                    className="w-full py-2 flex items-center justify-between text-left hover:bg-slate-50 rounded-xl px-2 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <SlidersHorizontal size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink text-xs sm:text-sm">More Options</span>
                          {hasMoreOptionsSet && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider shrink-0">
                              Customized
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-ink-muted truncate block">Page range, binding options &amp; special instructions</span>
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
                        showMoreOptions || hasMoreOptionsSet ? 'rotate-180 text-indigo-600' : ''
                      }`}
                    />
                  </button>

                  {(showMoreOptions || hasMoreOptionsSet) && (
                    <div className="pt-3 space-y-4 border-t border-slate-100 mt-2 animate-fade-in">
                      {/* Page Range with Visual Selector Button */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-ink text-xs block">
                            Page range <span className="text-ink-muted font-normal">(optional, default is all)</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={options.pageRange}
                            onChange={(e) => set('pageRange')(e.target.value)}
                            placeholder="all (e.g. 1-5, 8)"
                            className="field-input w-full text-xs h-9 bg-white flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => setShowVisualPageModal(true)}
                            className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs h-9 px-3 rounded-xl border border-indigo-200/80 font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Open Visual Page Selector Modal to select/unselect pages"
                          >
                            <Grid size={14} />
                            <span>Select Pages Visually</span>
                          </button>
                        </div>
                      </div>

                      {/* Binding Options */}
                      <div className="space-y-1.5">
                        <label className="font-semibold text-ink text-xs block">Binding options</label>
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
                                className={`p-2 rounded-xl text-left transition-all border ${
                                  active
                                    ? 'border-2 border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500/20 shadow-2xs'
                                    : 'border-line bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                                }`}
                              >
                                <p className="font-bold text-ink text-xs truncate">{b.label}</p>
                                <p className="text-[10px] text-ink-muted mt-0.5">
                                  {rate > 0 ? `+ ${formatMoney(rate)}` : 'Free'}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Special Instructions */}
                      <div>
                        <label className="font-semibold text-ink text-xs block mb-1">
                          Special instructions <span className="text-ink-muted font-normal">(optional)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={options.instructions}
                          onChange={(e) => set('instructions')(e.target.value)}
                          placeholder="Anything the print desk should know..."
                          className="field-input w-full text-xs py-2 bg-white resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Estimated Pricing (Down) + Actions */}
          <div className="space-y-4">
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
              showCoupon={false}
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

            <div className="flex flex-row items-center justify-between gap-3 pt-3 border-t border-line">
              <Button
                variant="secondary"
                onClick={editingCartItemId ? handleCancelEdit : () => goToStep(1)}
                className="text-xs h-11 px-5 rounded-xl shrink-0"
              >
                <ArrowLeft size={16} /> {editingCartItemId ? 'Cancel Edit' : 'Back to Upload'}
              </Button>

              <div className="flex items-center gap-2 shrink-0">
                {editingCartItemId ? (
                  <button
                    type="button"
                    onClick={() => {
                      updateCartItem(editingCartItemId, options, breakdown);
                      resetWizard();
                      setIsOpen(true);
                    }}
                    disabled={overLimit || !breakdown}
                    className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Check size={16} className="shrink-0" />
                    <span>Save &amp; Update Cart ({breakdown ? formatMoney(breakdown.totalAmount) : ''})</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  disabled={overLimit}
                  className="btn bg-accent hover:bg-accent/90 text-white font-bold text-xs sm:text-sm h-11 px-5 sm:px-6 rounded-xl shadow-md shadow-accent/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <span>Review &amp; Price ({breakdown ? formatMoney(breakdown.totalAmount) : ''})</span>
                  <ArrowRight size={16} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Visual Page Selector Modal */}
          {showVisualPageModal && doc && (
            <VisualPageSelectorModal
              doc={doc}
              pageRange={options.pageRange}
              onPageRangeChange={(newRange) => set('pageRange')(newRange)}
              onClose={() => setShowVisualPageModal(false)}
              grayscale={options.colorMode === 'BW'}
            />
          )}
        </div>
      )}

      {/* STEP 3 — Review & Price (Multi-File Unified Bill Preview Container) */}
      {step === 3 && docs.length > 0 && (
        <div className="max-w-2xl mx-auto card p-6 sm:p-8 space-y-6 shadow-pop border border-line">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <h2 className="font-display font-bold text-lg sm:text-xl text-ink">Order Summary &amp; Bill Preview</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Please review your document configuration{docs.length > 1 ? 's' : ''} ({docs.length} file{docs.length > 1 ? 's' : ''}) and pricing
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(2)} className="text-xs h-8 px-3">
              Edit Options
            </Button>
          </div>

          {/* List of ALL uploaded documents and their individual configurations */}
          <div className="space-y-6 divide-y divide-line/60">
            {docs.map((d, index) => {
              const opts = d.options || DEFAULT_OPTIONS;
              const estPages = estimatePagesFromRange(opts.pageRange, d.pageCount || 1);
              return (
                <div key={d.id || index} className={index > 0 ? 'pt-5 space-y-3' : 'space-y-3'}>
                  {/* Document Strip */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-paper-sunken border border-line">
                    <FileTypeIcon mimeType={d.mimeType} size={20} boxed />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink text-sm truncate">{d.originalName}</p>
                      <p className="text-xs text-ink-muted">
                        {estPages} print page{estPages > 1 ? 's' : ''} ({d.pageCount ? `${d.pageCount} total pages` : ''}) · {formatFileSize(d.fileSize)}
                      </p>
                    </div>
                    {docs.length > 1 && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono text-[11px] font-bold">
                        File {index + 1} of {docs.length}
                      </span>
                    )}
                  </div>

                  {/* Print Configuration Breakdown */}
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                      {docs.length > 1 ? `Print Configuration (${d.originalName})` : 'Print Configuration'}
                    </h4>
                    <div className="rounded-xl border border-line bg-paper-sunken/40 divide-y divide-line/70 text-xs">
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Print Colour:</span>
                        <span className="font-semibold text-ink">{opts.colorMode === 'COLOR' ? 'Full Colour' : 'Black & White'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Sides:</span>
                        <span className="font-semibold text-ink">{opts.sides === 'DOUBLE' ? 'Double-sided (Duplex)' : 'Single-sided'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Paper Size:</span>
                        <span className="font-semibold text-ink">{opts.paperSize || 'A4'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Orientation:</span>
                        <span className="font-semibold text-ink capitalize">{(opts.orientation || 'PORTRAIT').toLowerCase()}</span>
                      </div>
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Copies:</span>
                        <span className="font-semibold text-ink">{opts.copies || 1} {opts.copies === 1 ? 'copy' : 'copies'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Page Range:</span>
                        <span className="font-semibold text-ink">{opts.pageRange || 'All pages'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3.5 py-2.5">
                        <span className="text-ink-muted font-medium">Binding Option:</span>
                        <span className="font-semibold text-ink">{BINDING_OPTIONS.find((b) => b.value === opts.binding)?.label || 'None'}</span>
                      </div>
                      {opts.instructions && (
                        <div className="flex justify-between items-start px-3.5 py-2.5 gap-4">
                          <span className="text-ink-muted font-medium shrink-0">Instructions:</span>
                          <span className="font-semibold text-ink italic text-right">"{opts.instructions}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Price Breakdown */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Payment &amp; Price Breakdown</h3>
              {calcing && <Loader2 size={15} className="text-ink-faint animate-spin" />}
            </div>

            <div className="rounded-xl border border-line bg-paper-sunken/40 divide-y divide-line/70 text-xs">
              <div className="flex justify-between items-center px-3.5 py-2.5">
                <span className="text-ink-muted font-medium">Pages ({totalPages} × {options.copies || 1} {options.copies === 1 ? 'copy' : 'copies'}):</span>
                <span className="font-semibold text-ink">{breakdown ? formatMoney(breakdown.printCost) : '—'}</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-2.5">
                <span className="text-ink-muted font-medium">Rate per page:</span>
                <span className="text-ink-muted">{breakdown ? `${formatMoney(breakdown.effectivePageRate)}/pg` : '—'}</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-2.5">
                <span className="text-ink-muted font-medium">Binding:</span>
                <span className="font-semibold text-ink">{breakdown ? formatMoney(breakdown.bindingCost) : '—'}</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-2.5">
                <span className="text-ink-muted font-medium">Subtotal:</span>
                <span className="font-semibold text-ink">{breakdown ? formatMoney(breakdown.subtotal) : '—'}</span>
              </div>
              {breakdown?.discountAmount > 0 && (
                <div className="flex justify-between items-center px-3.5 py-2.5 text-emerald-700 bg-emerald-50/50">
                  <span className="font-medium">Coupon Discount:</span>
                  <span className="font-bold">-{formatMoney(breakdown.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-3.5 py-2.5">
                <span className="text-ink-muted font-medium">Service Charge ({Math.round((breakdown?.taxRate || 0.18) * 100)}%):</span>
                <span className="text-ink-muted">{breakdown ? formatMoney(breakdown.tax) : '—'}</span>
              </div>
              <div className="flex justify-between items-center px-3.5 py-3.5 bg-paper-sunken">
                <span className="font-display font-bold text-sm text-ink">Total Amount:</span>
                <span className="font-display font-bold text-xl sm:text-2xl text-accent">
                  {breakdown ? formatMoney(breakdown.totalAmount) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Coupon Code Section */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-line bg-paper-sunken/60 space-y-2 text-xs">
            <label className="font-semibold text-ink block">Have a coupon code?</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Enter coupon code (e.g. SAVE20)"
                className="field-input flex-1 uppercase text-xs h-9 min-w-0"
                disabled={!!appliedCoupon && !couponError}
              />
              {appliedCoupon && !couponError ? (
                <button
                  type="button"
                  onClick={() => { setAppliedCoupon(''); setCouponInput(''); }}
                  className="btn btn-secondary text-xs px-3 h-9 shrink-0"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(couponInput)}
                  className="btn bg-accent hover:bg-accent/90 text-white font-semibold text-xs px-4 h-9 shrink-0 shadow-2xs"
                  disabled={!couponInput.trim()}
                >
                  Apply
                </button>
              )}
            </div>
            {couponError && <p className="text-xs text-danger">{couponError}</p>}
            {appliedCoupon && !couponError && couponObj && (
              <p className="text-xs text-success font-medium">
                Coupon applied successfully ({couponObj.discountType === 'PERCENT' || couponObj.discountPercent ? `${couponObj.discountValue || couponObj.discountPercent}% OFF` : `₹${breakdown?.discountAmount || couponObj.discountValue || couponObj.discountAmount || 0} OFF`})
              </p>
            )}
          </div>

          {/* 4. Action Buttons (Fully Responsive, No Overflow) */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-line">
            <Button
              variant="secondary"
              onClick={() => goToStep(2)}
              className="text-xs h-10 px-4 justify-center"
            >
              <ArrowLeft size={16} /> Back to Options
            </Button>
            <button
              type="button"
              onClick={handleOpenPaymentModal}
              disabled={!breakdown || overLimit}
              className="btn bg-accent hover:bg-accent/90 text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-md shadow-accent/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>Proceed to Payment ({breakdown ? formatMoney(breakdown.totalAmount) : ''})</span>
              <ArrowRight size={16} className="shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — Receipt with Lottie Animation */}
      {step === 4 && receipt && (() => {
        const receiptOrderNumber = receipt.batchNumber || receipt.orderNumber || (receipt.orders && receipt.orders[0]?.orderNumber) || 'Order';
        const receiptDocumentList = (receipt.orders && Array.isArray(receipt.orders) && receipt.orders.length > 0)
          ? receipt.orders.map((o) => o.document?.originalName).filter(Boolean)
          : (receipt.document?.originalName ? [receipt.document.originalName] : (docs.length > 0 ? docs.map((d) => d.originalName).filter(Boolean) : ['Document']));

        return (
          <div className="max-w-xl mx-auto card p-6 sm:p-10 text-center relative overflow-hidden animate-scale-in">
            <div className="relative z-10 space-y-5">
              {/* Lottie Vector Celebration Animation */}
              <div className="w-44 h-44 mx-auto -my-2 flex items-center justify-center">
                <LottiePlayer className="w-full h-full" />
              </div>

              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                  <Sparkles size={12} /> Payment Confirmed &amp; Order Placed
                </span>
                <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-ink tracking-tight pt-1">
                  Printing Preparation Started!
                </h2>
                <p className="text-xs sm:text-sm text-ink-muted">
                  Your print order <strong className="font-mono text-accent">#{receiptOrderNumber}</strong> was paid successfully via <strong>Ink Wallet</strong>.
                </p>
              </div>

              <div className="p-5 text-left rounded-2xl bg-paper-sunken border border-line divide-y divide-line text-xs sm:text-sm shadow-2xs space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="text-ink-muted">Order Number</span>
                  <span className="font-mono font-bold text-accent">{receiptOrderNumber}</span>
                </div>
                <div className="flex justify-between items-start py-1 gap-3">
                  <span className="text-ink-muted shrink-0">Document(s)</span>
                  <div className="text-right min-w-0">
                    <span
                      className="font-semibold text-ink block truncate max-w-[260px]"
                      title={receiptDocumentList.join(', ')}
                    >
                      {receiptDocumentList.length > 1
                        ? `${receiptDocumentList.length} Files (${receiptDocumentList.join(', ')})`
                        : (receiptDocumentList[0] || 'Document')}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-ink-muted">Payment Method</span>
                  <span className="font-semibold text-emerald-700">Ink Wallet (Instant)</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-ink-muted">Total Paid</span>
                  <span className="font-bold text-emerald-700 text-base font-display">{formatMoney(receipt.totalAmount)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={
                    receipt?.batchNumber || (receipt?.orders && receipt.orders.length > 0)
                      ? batchInvoiceUrl(receipt.id)
                      : invoiceUrl(receipt.id)
                  }
                  download={`Invoice-${receiptOrderNumber}.pdf`}
                  className="btn btn-primary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 shadow-sm font-semibold"
                >
                  <Download size={15} /> Download Invoice (PDF)
                </a>
                <Link
                  to={`/user/orders?track=${encodeURIComponent(receiptOrderNumber)}`}
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
        );
      })()}

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

function PriceSummary({
  breakdown,
  calcing,
  totalPages,
  copies,
  couponInput,
  setCouponInput,
  appliedCoupon,
  setAppliedCoupon,
  couponError,
  couponObj,
  showCoupon = true,
}) {
  const b = breakdown;
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">
          {showCoupon ? 'Payment & Price Summary' : 'Estimated Pricing'}
        </h3>
        {calcing && <Loader2 size={16} className="text-ink-faint animate-spin" aria-label="Recalculating" />}
      </div>
      <dl className="space-y-2 text-sm">
        <Row label={`Pages (${totalPages} ${totalPages === 1 ? 'page' : 'pages'})`} value={b ? formatMoney(b.printCost) : '—'} />
        <Row label="Rate per page" value={b ? `${formatMoney(b.effectivePageRate)}/pg` : '—'} muted />
        <Row label="Binding" value={b ? formatMoney(b.bindingCost) : '—'} />
        <Row label="Subtotal" value={b ? formatMoney(b.subtotal) : '—'} />
        {b?.discountAmount > 0 && (
          <Row label="Discount" value={`-${formatMoney(b.discountAmount)}`} />
        )}
        <Row label={`GST (${Math.round((b?.taxRate || 0) * 100)}%)`} value={b ? formatMoney(b.tax) : '—'} muted />
        <div className="flex items-baseline justify-between pt-3 mt-1 border-t border-line">
          <dt className="font-display font-semibold text-ink">Total Amount</dt>
          <dd className="font-display font-bold text-2xl text-accent">{b ? formatMoney(b.totalAmount) : '—'}</dd>
        </div>
      </dl>

      {/* Coupon Code section — only displayed in Review & Price (Step 3) */}
      {showCoupon && (
        <div className="pt-4 border-t border-line space-y-2">
          <label className="text-xs font-semibold text-ink block">Have a coupon code?</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="e.g. SAVE20"
              className="field-input flex-1 uppercase text-xs"
              disabled={!!appliedCoupon && !couponError}
            />
            {appliedCoupon && !couponError ? (
              <button
                type="button"
                onClick={() => { setAppliedCoupon(''); setCouponInput(''); }}
                className="btn btn-secondary text-xs px-3"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAppliedCoupon(couponInput)}
                className="btn btn-primary text-xs px-4"
                disabled={!couponInput.trim()}
              >
                Apply
              </button>
            )}
          </div>
          {couponError && <p className="text-xs text-danger">{couponError}</p>}
          {appliedCoupon && !couponError && couponObj && (
            <p className="text-xs text-success font-medium flex items-center gap-1">
              ✓ Coupon applied successfully! ({couponObj.discountType === 'PERCENT' || couponObj.discountPercent ? `${couponObj.discountValue || couponObj.discountPercent}% OFF` : `₹${breakdown?.discountAmount || couponObj.discountValue || couponObj.discountAmount || 0} OFF`})
            </p>
          )}
        </div>
      )}
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
