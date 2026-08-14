import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShoppingBag,
  X,
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
} from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';
import { api } from '../../lib/api.js';
import { formatMoney, formatMoneyIN, formatFileSize } from '../../lib/format.js';
import { useToast } from '../Toaster.jsx';
import FileTypeIcon from '../FileTypeIcon.jsx';
import Button from '../Button.jsx';
import LottiePlayer from '../LottiePlayer.jsx';

export default function CartSidebar() {
  const { cartItems, cartTotal, removeFromCart, clearCart, isOpen, setIsOpen, editCartItem } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  // Modal / Payment states
  const [checkoutStep, setCheckoutStep] = useState('CART'); // 'CART' | 'PAYMENT' | 'SUCCESS'
  const [selectedPayMethod, setSelectedPayMethod] = useState('WALLET'); // 'WALLET' | 'UPI'
  const [userWallet, setUserWallet] = useState(null);
  const [loadingPaymentInfo, setLoadingPaymentInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successBatch, setSuccessBatch] = useState(null);

  // Load wallet balance when payment step opens
  useEffect(() => {
    if (checkoutStep === 'PAYMENT' && isOpen) {
      loadWalletBalance();
    }
  }, [checkoutStep, isOpen]);

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

  if (!isOpen) return null;

  // Process Ink Wallet Batch Payment
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
      setSuccessBatch({
        batch: payRes.batch || createdBatch,
        orders: payRes.orders || createdOrders,
        paidWithWallet: true,
      });
      setCheckoutStep('SUCCESS');
      toast('Batch payment successful! All print jobs confirmed.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to process Ink Wallet batch payment', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseModal() {
    setSuccessBatch(null);
    setCheckoutStep('CART');
    setIsOpen(false);
  }

  function handleGoToOrders() {
    setSuccessBatch(null);
    setCheckoutStep('CART');
    setIsOpen(false);
    navigate('/user/orders');
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between bg-paper-sunken shrink-0">
          <div className="flex items-center gap-2.5">
            {checkoutStep === 'PAYMENT' ? (
              <button
                type="button"
                onClick={() => setCheckoutStep('CART')}
                className="h-8 w-8 rounded-full hover:bg-line/50 flex items-center justify-center text-ink-soft hover:text-ink mr-0.5"
                title="Back to Cart"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <span className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <ShoppingBag size={18} />
            </span>
            <div>
              <h3 className="font-display font-bold text-ink text-base">
                {checkoutStep === 'SUCCESS'
                  ? 'Order Confirmed'
                  : checkoutStep === 'PAYMENT'
                  ? 'Batch Payment'
                  : 'Print Cart'}
              </h3>
              <p className="text-xs text-ink-muted">
                {checkoutStep === 'SUCCESS'
                  ? 'Sent to Print Queue'
                  : checkoutStep === 'PAYMENT'
                  ? `Pay for ${cartItems.length} document${cartItems.length === 1 ? '' : 's'}`
                  : `${cartItems.length} document${cartItems.length === 1 ? '' : 's'} staged`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="h-8 w-8 rounded-full hover:bg-line/50 flex items-center justify-center text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. SUCCESS SCREEN */}
        {checkoutStep === 'SUCCESS' && successBatch ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4 animate-scale-in">
            <div className="w-36 h-36 mx-auto -my-3 flex items-center justify-center">
              <LottiePlayer className="w-full h-full" />
            </div>

            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                Payment Confirmed &amp; Placed
              </span>
              <h2 className="text-xl font-display font-bold text-ink mt-2">
                #{successBatch.batch?.batchNumber || 'BATCH-ORDER'}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                Total Paid: <strong className="text-ink">₹{(successBatch.batch?.totalAmount || cartTotal).toFixed(2)}</strong> via Ink Wallet
              </p>
            </div>

            <div className="w-full card p-3.5 space-y-2 text-left bg-paper-sunken border border-line text-xs">
              <div className="flex items-center justify-between text-ink font-semibold border-b border-line/60 pb-2">
                <span>Print Queue Items ({successBatch.orders?.length || cartItems.length})</span>
                <span className="text-emerald-700 font-bold">PROCESSING</span>
              </div>
              <ul className="space-y-1.5 pt-1 text-ink-muted max-h-36 overflow-y-auto pr-1">
                {successBatch.orders?.map((o, idx) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <span className="truncate max-w-[200px] text-ink font-medium">
                      {idx + 1}. {o.document?.originalName || o.orderNumber}
                    </span>
                    <span className="font-mono text-[11px]">₹{o.totalAmount?.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full space-y-2.5 pt-2">
              <Button type="button" block size="lg" onClick={handleGoToOrders}>
                Track All Orders <ArrowRight size={16} />
              </Button>
              <Button type="button" block variant="secondary" onClick={handleCloseModal}>
                Print More Documents
              </Button>
            </div>
          </div>
        ) : null}

        {/* 2. PAYMENT SELECTION SCREEN */}
        {checkoutStep === 'PAYMENT' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 animate-fade-in">
            {/* Batch Order Summary Bar */}
            <div className="p-3.5 rounded-2xl bg-paper-sunken border border-line flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-ink">
                  Batch Order ({cartItems.length} document{cartItems.length === 1 ? '' : 's'})
                </p>
                <p className="text-[11px] text-ink-muted">All print configurations staged</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">Total Payable</span>
                <span className="text-lg font-bold text-accent font-display">
                  ₹{cartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method 1: Ink Wallet */}
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

            {/* Payment Method 2: UPI / QR Code (Paused by Admin) */}
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
                    Please use your <strong>Ink Wallet</strong> balance above to complete your batch print order instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* 3. CART ITEMS LIST SCREEN */}
        {checkoutStep === 'CART' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {cartItems.length === 0 ? (
              <div className="py-16 text-center text-ink-muted space-y-3">
                <ShoppingBag size={40} className="mx-auto text-line" />
                <p className="font-display font-semibold text-ink text-sm">Your print cart is empty</p>
                <p className="text-xs max-w-xs mx-auto">
                  Configure documents in the Print Hub and click "Add to Cart" to batch print multiple files in one order.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="card p-3.5 space-y-2.5 border border-line hover:border-accent/60 hover:shadow-md transition-all group bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => editCartItem(item, navigate)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      title="Click to edit print options in Print Hub"
                    >
                      <FileTypeIcon mimeType={item.doc?.mimeType} size={18} boxed />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-ink text-xs truncate group-hover:text-accent transition-colors">
                            {item.doc?.originalName || 'Document'}
                          </p>
                        </div>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {item.doc?.pageCount ? `${item.doc.pageCount} pages · ` : ''}
                          {formatFileSize(item.doc?.fileSize)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => editCartItem(item, navigate)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-accent bg-accent-soft hover:bg-accent hover:text-white transition-all shadow-2xs"
                        title="Edit print options"
                      >
                        <SlidersHorizontal size={13} />
                        <span className="text-[11px]">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-danger-faint hover:text-danger p-1.5 rounded-lg hover:bg-danger-soft transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Print Options Badges */}
                  <div
                    onClick={() => editCartItem(item, navigate)}
                    className="flex flex-wrap gap-1.5 pt-1 cursor-pointer"
                    title="Click to edit print options"
                  >
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.options?.colorMode === 'COLOR' ? 'bg-pink-500' : 'bg-slate-700'}`} />
                      {item.options?.colorMode === 'COLOR' ? 'Color' : 'B&W'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                      {item.options?.orientation === 'LANDSCAPE' ? <Monitor size={10} /> : <Smartphone size={10} />}
                      {item.options?.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                      {item.options?.paperSize || 'A4'} · {item.options?.sides === 'DOUBLE' ? 'Duplex' : 'Single'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                      {item.options?.copies || 1} cop{item.options?.copies === 1 ? 'y' : 'ies'}
                    </span>
                    {item.options?.pageRange && item.options?.pageRange !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                        Pages: {item.options.pageRange}
                      </span>
                    )}
                    {item.options?.binding && item.options?.binding !== 'none' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 text-[10px] font-semibold border border-purple-200 capitalize">
                        {item.options.binding}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-line/60">
                    <span className="text-[11px] text-ink-muted">
                      {item.breakdown?.totalPages || item.doc?.pageCount || 1} pages to print
                    </span>
                    <span className="font-bold text-accent text-sm">
                      ₹{(item.breakdown?.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Footer Checkout (Only on CART view) */}
        {checkoutStep === 'CART' && cartItems.length > 0 ? (
          <div className="p-4 sm:p-5 border-t border-line bg-paper-sunken space-y-3 shrink-0">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Items Subtotal ({cartItems.length} documents):</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-ink text-sm pt-1 border-t border-line/60">
                <span>Total Batch Amount:</span>
                <span className="text-accent text-base">₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button
              type="button"
              block
              size="lg"
              onClick={() => setCheckoutStep('PAYMENT')}
            >
              Proceed to Payment ({cartItems.length} Docs) <ArrowRight size={16} />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
