import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Wallet as WalletIcon,
  Sparkles,
  QrCode,
  Check,
  AlertTriangle,
  Zap,
  Loader2,
  Lock,
  SlidersHorizontal,
  Layers,
  Smartphone,
  Monitor,
  Printer,
  FilePlus,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';
import { api, batchInvoiceUrl } from '../../lib/api.js';
import { formatMoney, formatMoneyIN, formatFileSize, updateGlobalWalletBalance } from '../../lib/format.js';
import { useToast } from '../../components/Toaster.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import Button from '../../components/Button.jsx';
import LottiePlayer from '../../components/LottiePlayer.jsx';

export default function Cart() {
  const { cartItems, cartTotal, removeFromCart, clearCart, editCartItem } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  // Payment states
  const [selectedPayMethod, setSelectedPayMethod] = useState('WALLET'); // 'WALLET' | 'UPI'
  const [userWallet, setUserWallet] = useState(null);
  const [loadingPaymentInfo, setLoadingPaymentInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successBatch, setSuccessBatch] = useState(null);

  useEffect(() => {
    loadWalletBalance();
  }, []);

  const loadWalletBalance = async () => {
    setLoadingPaymentInfo(true);
    try {
      const res = await api.get('/wallet').catch(() => ({ wallet: null }));
      if (res?.wallet) {
        setUserWallet(res.wallet);
      }
    } catch (err) {
      console.error('Failed to load wallet:', err);
    } finally {
      setLoadingPaymentInfo(false);
    }
  };

  async function handlePayWithWallet() {
    if (!cartItems.length) return;
    setSubmitting(true);
    try {
      const itemsPayload = cartItems.map((item) => ({
        documentId: item.doc.id,
        colorMode: item.options.colorMode,
        paperSize: item.options.paperSize,
        sides: item.options.sides,
        copies: item.options.copies,
        pageRange: item.options.pageRange,
        binding: item.options.binding,
        instructions: item.options.instructions,
        orientation: item.options.orientation || 'PORTRAIT',
        totalPages: item.breakdown?.totalPages || item.doc.pageCount || 1,
      }));

      // 1. Create Batch Order with WALLET payment method
      const res = await api.post('/batch-orders', {
        items: itemsPayload,
        paymentMethod: 'WALLET',
      });

      const createdBatch = res.batch;
      const createdOrders = res.orders || [];

      // 2. Perform atomic Ink Wallet payment & balance debit
      const payRes = await api.post('/wallet/pay-batch', { batchId: createdBatch.id });

      clearCart();
      if (payRes?.balanceAfter !== undefined) updateGlobalWalletBalance(payRes.balanceAfter);
      setSuccessBatch({
        batch: payRes.batch || createdBatch,
        orders: payRes.orders || createdOrders,
        paidWithWallet: true,
      });
      toast('Batch payment successful! All print jobs confirmed.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to process Ink Wallet batch payment', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // 1. SUCCESS VIEW
  if (successBatch) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-center space-y-6 animate-scale-in">
        <div className="w-40 h-40 mx-auto flex items-center justify-center">
          <LottiePlayer className="w-full h-full" />
        </div>

        <div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3.5 py-1 rounded-full uppercase tracking-wider">
            Payment Confirmed &amp; Placed
          </span>
          <h2 className="text-2xl font-display font-bold text-ink mt-3">
            #{successBatch.batch?.batchNumber || 'BATCH-ORDER'}
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Total Paid: <strong className="text-ink">₹{(successBatch.batch?.totalAmount || cartTotal).toFixed(2)}</strong> via Ink Wallet
          </p>
        </div>

        <div className="w-full card p-5 space-y-3 text-left bg-paper-sunken border border-line text-xs shadow-sm">
          <div className="flex items-center justify-between text-ink font-semibold border-b border-line/60 pb-2.5">
            <span>Print Queue Items ({successBatch.orders?.length || cartItems.length})</span>
            <span className="text-emerald-700 font-bold">PROCESSING</span>
          </div>
          <ul className="space-y-2 pt-1 text-ink-muted max-h-48 overflow-y-auto pr-1">
            {successBatch.orders?.map((o, idx) => (
              <li key={o.id} className="flex items-center justify-between">
                <span className="truncate max-w-[280px] text-ink font-medium">
                  {idx + 1}. {o.document?.originalName || o.orderNumber}
                </span>
                <span className="font-mono text-xs font-semibold">₹{o.totalAmount?.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {successBatch?.batch?.id && (
            <a
              href={batchInvoiceUrl(successBatch.batch.id)}
              download={`Invoice-${successBatch.batch.batchNumber || 'batch'}.pdf`}
              className="btn bg-accent text-white hover:bg-accent-hover text-xs sm:text-sm h-11 px-5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
            >
              <Download size={16} /> Download Invoice (PDF)
            </a>
          )}
          <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/user/orders')} className="w-full sm:w-auto">
            Track All Orders <ArrowRight size={16} />
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={() => navigate('/user/print')} className="w-full sm:w-auto">
            Print More Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-white to-accent-soft/60 p-6 sm:p-7 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-accent text-white flex items-center justify-center shadow-md shadow-accent/20">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink">My Print Cart</h1>
              <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
                {cartItems.length} document{cartItems.length === 1 ? '' : 's'} staged for printing
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/user/print"
            className="btn btn-secondary text-xs sm:text-sm inline-flex items-center gap-2 h-10 px-4"
          >
            <FilePlus size={15} /> Add More Files
          </Link>
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-danger-faint hover:text-danger hover:bg-danger-soft px-3 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Clear Cart
            </button>
          )}
        </div>
      </div>

      {cartItems.length === 0 ? (
        <div className="card p-12 text-center space-y-4 border border-line shadow-sm">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <ShoppingBag size={32} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-ink text-base">Your print cart is empty</h3>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-sm mx-auto">
              Configure documents in the Print Hub and click "Add to Cart" to stage multiple documents for a single batch payment.
            </p>
          </div>
          <Link to="/user/print" className="btn btn-primary text-xs sm:text-sm inline-flex items-center gap-2">
            <Printer size={16} /> Go to Print Hub
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of Cart Items */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Staged Documents ({cartItems.length})
              </span>
              <span className="text-xs text-ink-muted">Click any item to edit print options</span>
            </div>

            {cartItems.map((item, idx) => (
              <div
                key={item.id}
                className="card p-4 space-y-3 border border-line hover:border-accent/60 hover:shadow-md transition-all group bg-white relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => editCartItem(item, navigate)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    title="Click to edit print options in Print Hub"
                  >
                    <FileTypeIcon mimeType={item.doc?.mimeType} size={22} boxed />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-ink-muted">#{idx + 1}</span>
                        <p className="font-semibold text-ink text-sm truncate group-hover:text-accent transition-colors">
                          {item.doc?.originalName || 'Document'}
                        </p>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {item.doc?.pageCount ? `${item.doc.pageCount} pages · ` : ''}
                        {formatFileSize(item.doc?.fileSize)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => editCartItem(item, navigate)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-accent bg-accent-soft hover:bg-accent hover:text-white transition-all shadow-2xs"
                      title="Edit print options for this document"
                    >
                      <SlidersHorizontal size={14} />
                      <span>Edit Options</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-danger-faint hover:text-danger p-2 rounded-xl hover:bg-danger-soft transition-colors"
                      title="Remove from cart"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Print Options Badges */}
                <div
                  onClick={() => editCartItem(item, navigate)}
                  className="flex flex-wrap gap-1.5 pt-1 cursor-pointer"
                  title="Click to edit print options"
                >
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                    <span className={`w-2 h-2 rounded-full ${item.options?.colorMode === 'COLOR' ? 'bg-pink-500' : 'bg-slate-700'}`} />
                    {item.options?.colorMode === 'COLOR' ? 'Color Print' : 'Black & White'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                    {item.options?.orientation === 'LANDSCAPE' ? <Monitor size={13} /> : <Smartphone size={13} />}
                    {item.options?.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                    {item.options?.paperSize || 'A4'} · {item.options?.sides === 'DOUBLE' ? 'Duplex (2-sided)' : 'Single-sided'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                    {item.options?.copies || 1} set{item.options?.copies === 1 ? '' : 's'}
                  </span>
                  {item.options?.pageRange && item.options?.pageRange !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                      Pages: {item.options.pageRange}
                    </span>
                  )}
                  {item.options?.binding && item.options?.binding !== 'none' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 text-xs font-semibold border border-purple-200 capitalize">
                      Binding: {item.options.binding}
                    </span>
                  )}
                  {item.options?.instructions && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200 truncate max-w-xs">
                      Note: {item.options.instructions}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-line/60">
                  <span className="text-ink-muted">
                    Total Sheets to print: <strong className="text-ink">{item.breakdown?.totalPages || item.doc?.pageCount || 1}</strong>
                  </span>
                  <span className="font-bold text-accent text-base">
                    ₹{(item.breakdown?.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Checkout & Payment Options */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
            <div className="card p-5 space-y-4 border border-line shadow-sm">
              <h3 className="font-display font-bold text-ink text-base">Order &amp; Payment Summary</h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Documents in Batch:</span>
                  <span className="font-semibold text-ink">{cartItems.length}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Total Print Sheets:</span>
                  <span className="font-semibold text-ink">
                    {cartItems.reduce((acc, it) => acc + (it.breakdown?.totalPages || it.doc?.pageCount || 1), 0)}
                  </span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-ink">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink text-base pt-2 border-t border-line">
                  <span>Total Payable:</span>
                  <span className="text-accent text-lg">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Ink Wallet Method */}
              <div
                onClick={() => setSelectedPayMethod('WALLET')}
                role="button"
                tabIndex={0}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  selectedPayMethod === 'WALLET'
                    ? 'border-accent bg-accent-soft/30 ring-2 ring-accent/20 shadow-xs'
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
                        <strong className={userWallet && userWallet.balance >= cartTotal ? 'text-emerald-700' : 'text-rose-600'}>
                          {loadingPaymentInfo ? '...' : formatMoneyIN(userWallet?.balance || 0)}
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

                {selectedPayMethod === 'WALLET' && (
                  <div className="mt-3.5 pt-3 border-t border-line/70 space-y-3">
                    {userWallet && userWallet.balance >= cartTotal ? (
                      <>
                        <div className="flex items-center justify-between text-xs text-ink-soft">
                          <span>Balance after batch payment:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatMoneyIN(userWallet.balance - cartTotal)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handlePayWithWallet}
                          disabled={submitting}
                          className="btn btn-primary text-xs sm:text-sm w-full py-3 inline-flex items-center justify-center gap-2 shadow-sm font-bold"
                        >
                          {submitting ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Processing Batch Payment...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={16} />
                              <span>Pay ₹{cartTotal.toFixed(2)} &amp; Print All ({cartItems.length} Docs)</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-amber-950">Insufficient Balance</span>
                            <p className="mt-0.5 text-[11px] text-amber-800">
                              You need{' '}
                              <strong>
                                {formatMoney(Math.max(0, cartTotal - (userWallet?.balance || 0)))}
                              </strong>{' '}
                              more. Please ask your store administrator to top up your balance.
                            </p>
                          </div>
                        </div>
                        <Link
                          to="/user/wallet"
                          className="btn btn-secondary text-xs w-full py-2.5 inline-flex items-center justify-center gap-2"
                        >
                          <WalletIcon size={14} /> View / Top-Up Ink Wallet
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* UPI Paused Method */}
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
                          <Lock size={10} /> Paused
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
