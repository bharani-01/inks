import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, invoiceUrl } from '../../lib/api';
import { formatMoney, formatMoneyIN, formatDateTime, formatDate, formatFileSize, updateGlobalWalletBalance } from '../../lib/format';
import { useToast } from '../../components/Toaster';
import FileTypeIcon from '../../components/FileTypeIcon';
import {
  QrCode,
  Smartphone,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Layers,
  Printer,
  HelpCircle,
  Wallet as WalletIcon,
  Zap,
} from 'lucide-react';

export default function PayOrder() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [payingWithWallet, setPayingWithWallet] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('WALLET'); // 'WALLET' | 'UPI'

  const fetchOrderAndSettings = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const [orderRes, pricingRes, walletRes] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get('/settings/pricing').catch(() => ({ pricing: null })),
        api.get('/wallet').catch(() => ({ wallet: null })),
      ]);

      const o = orderRes.order || orderRes;
      setOrder(o);
      if (o?.upiRefNumber) {
        setUtrInput(o.upiRefNumber);
      }
      if (pricingRes?.pricing) {
        setPricing(pricingRes.pricing);
      }
      if (walletRes?.wallet) {
        setWallet(walletRes.wallet);
        // Default to WALLET if sufficient balance, else UPI
        if (o?.totalAmount && walletRes.wallet.balance < o.totalAmount) {
          setPaymentMethod('UPI');
        }
      }
    } catch (err) {
      toast(err.message || 'Failed to load order payment details', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderAndSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Live polling every 5s if pending
  useEffect(() => {
    if (!order || order.paymentStatus === 'PAID') return;

    const interval = setInterval(() => {
      fetchOrderAndSettings(true);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.paymentStatus, orderId]);

  const merchantUpiId = pricing?.merchantUpiId || '9790066224@kotakbank';
  const merchantName = pricing?.merchantName || 'Inks Cloud Print';

  // Construct standard UPI deep-link URI
  const totalStr = order ? Number(order.totalAmount).toFixed(2) : '0.00';
  const orderNum = order?.orderNumber || `Order-${orderId}`;
  const upiUri = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(merchantName)}&am=${totalStr}&tn=${encodeURIComponent(`Inks ${orderNum}`)}&cu=INR`;

  // Generate crisp local high-res QR code
  useEffect(() => {
    if (!order) return;
    QRCode.toDataURL(upiUri, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate local QR code:', err));
  }, [upiUri, order]);

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(merchantUpiId);
    setCopiedVpa(true);
    toast(`UPI ID ${merchantUpiId} copied!`, 'success');
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(totalStr);
    setCopiedAmount(true);
    toast(`Amount ₹${totalStr} copied!`, 'success');
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleSubmitUtr = async (e) => {
    e?.preventDefault();
    setSubmittingUtr(true);
    try {
      const res = await api.post(`/orders/${orderId}/submit-utr`, {
        upiRefNumber: utrInput.trim() || undefined,
      });
      setOrder(res.order);
      toast('Payment details submitted for verification!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to submit payment details', 'error');
    } finally {
      setSubmittingUtr(false);
    }
  };

  const handlePayFromWallet = async () => {
    setPayingWithWallet(true);
    try {
      const res = await api.post('/wallet/pay', {
        orderId: order.id,
      });
      setOrder(res.order);
      const newBal = res.balanceAfter !== undefined ? res.balanceAfter : res.newBalance;
      setWallet((w) => ({ ...w, balance: newBal }));
      if (newBal !== undefined) updateGlobalWalletBalance(newBal);
      toast(res.message || 'Order paid successfully from Ink Wallet!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to process Ink Wallet payment', 'error');
    } finally {
      setPayingWithWallet(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-line rounded-xl w-1/4"></div>
        <div className="h-32 bg-line rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 h-96 bg-line rounded-2xl"></div>
          <div className="md:col-span-5 h-96 bg-line rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto p-8 card text-center space-y-4 my-12">
        <AlertTriangle size={36} className="text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-ink">Order Not Found</h2>
        <p className="text-xs text-ink-muted">The requested order could not be located.</p>
        <Link to="/user/orders" className="btn btn-primary text-xs inline-block">
          View My Orders
        </Link>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';
  const isFailed = order.paymentStatus === 'FAILED';
  const isPending = order.paymentStatus === 'PENDING';
  const isWalletPaid = isPaid && (order.paymentMethod === 'WALLET' || order.walletAmount > 0);
  const currentWalletBalance = wallet?.balance || 0;
  const hasSufficientWalletBalance = currentWalletBalance >= (order.totalAmount || 0);

  return (
    <div className="max-w-5xl lg:max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Link to="/user/orders" className="hover:text-ink transition-colors font-medium">
          My Orders
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink font-semibold">Order #{order.orderNumber}</span>
      </div>

      {/* SUCCESS STATE */}
      {isPaid ? (
        <div className="card p-8 sm:p-12 text-center space-y-6 bg-gradient-to-b from-green-50/70 via-white to-white border-green-200 shadow-pop animate-scale-in">
          <div className="h-20 w-20 rounded-3xl bg-green-600 text-white mx-auto flex items-center justify-center shadow-xl shadow-green-600/25">
            <CheckCircle2 size={44} />
          </div>

          <div className="max-w-lg mx-auto space-y-2">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 uppercase tracking-wider">
              {isWalletPaid ? 'Paid with Ink Wallet' : 'Payment Confirmed'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink pt-1">
              Order Confirmed for Printing!
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              {isWalletPaid ? (
                <>
                  Your payment of <strong className="text-ink">{formatMoney(order.totalAmount)}</strong> was completed instantly via <strong>Ink Wallet</strong>.
                </>
              ) : (
                <>
                  Your UPI payment of <strong className="text-ink">{formatMoney(order.totalAmount)}</strong> has been verified.
                </>
              )}{' '}
              The print station is preparing your document now.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-paper border border-line max-w-md mx-auto text-left text-xs sm:text-sm space-y-2.5 shadow-2xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">Order Number</span>
              <span className="font-mono font-bold text-accent">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Document</span>
              <span className="font-medium text-ink truncate max-w-[220px]">
                {order.document?.originalName || 'Document'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Payment Method</span>
              <span className="font-semibold text-ink">
                {isWalletPaid ? '💳 Ink Wallet (Instant)' : '📱 UPI Payment'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Total Paid</span>
              <span className="font-bold text-green-700 font-display">{formatMoney(order.totalAmount)}</span>
            </div>
            {order.upiRefNumber && !isWalletPaid && (
              <div className="flex justify-between border-t border-line pt-2">
                <span className="text-ink-muted">Submitted UTR / Ref</span>
                <span className="font-mono font-bold text-ink">{order.upiRefNumber}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={invoiceUrl(order.id)}
              download={`Invoice-${order.orderNumber}.pdf`}
              className="btn btn-primary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 shadow-sm"
            >
              <Download size={15} /> Download Tax Invoice (PDF)
            </a>
            <Link
              to={`/user/orders`}
              className="btn btn-secondary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5"
            >
              <FileText size={15} /> Track Print Progress
            </Link>
          </div>
        </div>
      ) : (
        /* PENDING PAYMENT STATE */
        <div className="space-y-6">
          {/* Header Summary Banner */}
          <div className="card p-6 sm:p-8 bg-gradient-to-r from-accent-soft/40 via-white to-white border-accent/15 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider bg-accent-soft px-2.5 py-0.5 rounded-full">
                  Checkout &amp; Payment
                </span>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink pt-1">
                  Complete Payment for Order #{order.orderNumber}
                </h1>
                <p className="text-xs sm:text-sm text-ink-muted max-w-xl">
                  Choose your preferred payment method below. Ink Wallet payments complete immediately without scanning or waiting.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-paper border border-line flex flex-col items-start md:items-end justify-center shrink-0">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Amount Payable</span>
                <div className="text-3xl sm:text-4xl font-display font-bold text-accent mt-0.5">
                  {formatMoney(order.totalAmount)}
                </div>
              </div>
            </div>

            {/* Rejection Alert if failed */}
            {isFailed && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Previous verification could not be confirmed</strong>
                  <p className="mt-0.5">
                    Reason: <em>{order.paymentRejectReason || 'Payment not detected in merchant account statement'}</em>.
                  </p>
                  <p className="text-[11px] text-rose-700 mt-1">
                    Please transfer using the QR code below or pay directly with your Ink Wallet.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Switcher Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('WALLET')}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center justify-between ${
                paymentMethod === 'WALLET'
                  ? 'border-accent bg-accent-soft/30 ring-2 ring-accent/20 shadow-sm'
                  : 'border-line bg-white hover:bg-paper-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'WALLET' ? 'bg-accent text-white' : 'bg-paper-hover text-ink-soft'
                  }`}
                >
                  <WalletIcon size={22} />
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
                    <strong className={hasSufficientWalletBalance ? 'text-emerald-700' : 'text-rose-600'}>
                      {formatMoneyIN(currentWalletBalance)}
                    </strong>
                  </p>
                </div>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'WALLET' ? 'border-accent bg-accent text-white' : 'border-line'
                }`}
              >
                {paymentMethod === 'WALLET' && <Check size={12} strokeWidth={3} />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center justify-between ${
                paymentMethod === 'UPI'
                  ? 'border-accent bg-accent-soft/30 ring-2 ring-accent/20 shadow-sm'
                  : 'border-line bg-white hover:bg-paper-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'UPI' ? 'bg-accent text-white' : 'bg-paper-hover text-ink-soft'
                  }`}
                >
                  <QrCode size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">UPI QR / App</span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">GPay, PhonePe, Paytm, CRED &amp; BHIM</p>
                </div>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'UPI' ? 'border-accent bg-accent text-white' : 'border-line'
                }`}
              >
                {paymentMethod === 'UPI' && <Check size={12} strokeWidth={3} />}
              </div>
            </button>
          </div>

          {/* PAYMENT METHOD VIEW 1: INK WALLET */}
          {paymentMethod === 'WALLET' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Wallet Pay Card (7 Cols) */}
              <div className="lg:col-span-7 card p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-line pb-3.5">
                  <span className="text-sm font-bold text-ink flex items-center gap-2">
                    <WalletIcon size={18} className="text-accent" />
                    Pay with Ink Wallet Balance
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Zap size={12} /> Instant Print Trigger
                  </span>
                </div>

                {/* Balance breakdown card */}
                <div className="p-5 rounded-2xl bg-paper border border-line space-y-3">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-ink-muted">Current Ink Wallet Balance:</span>
                    <span className="font-mono font-bold text-ink text-base">{formatMoneyIN(currentWalletBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-ink-muted">Order Total to Deduct:</span>
                    <span className="font-mono font-bold text-rose-600 text-base">-{formatMoney(order.totalAmount)}</span>
                  </div>
                  <div className="border-t border-line pt-3 flex justify-between items-center text-xs sm:text-sm">
                    <span className="font-semibold text-ink">Projected Balance After Payment:</span>
                    <span
                      className={`font-mono font-bold text-base ${
                        hasSufficientWalletBalance ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {formatMoneyIN(Math.max(0, currentWalletBalance - order.totalAmount))}
                    </span>
                  </div>
                </div>

                {/* Sufficient vs Insufficient Balance CTA */}
                {hasSufficientWalletBalance ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handlePayFromWallet}
                      disabled={payingWithWallet}
                      className="btn btn-primary text-sm w-full py-4 inline-flex items-center justify-center gap-2.5 shadow-md shadow-accent/20 font-bold"
                    >
                      {payingWithWallet ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>Processing Instant Payment...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={18} />
                          <span>Pay {formatMoney(order.totalAmount)} from Ink Wallet</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-ink-muted text-center flex items-center justify-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      <span>Atomic, instant deduction. No UTR number or manual approval needed.</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-sm font-bold text-amber-950">Insufficient Wallet Balance</strong>
                        <p className="mt-1 text-amber-800">
                          You have <strong>{formatMoneyIN(currentWalletBalance)}</strong> available, but this order requires{' '}
                          <strong>{formatMoney(order.totalAmount)}</strong> (Deficit:{' '}
                          <strong>{formatMoney(order.totalAmount - currentWalletBalance)}</strong>).
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('UPI')}
                        className="btn btn-primary text-xs w-full py-3 inline-flex items-center justify-center gap-2"
                      >
                        <QrCode size={15} /> Switch to UPI Payment
                      </button>
                      <Link
                        to="/user/wallet"
                        className="btn btn-secondary text-xs w-full py-3 inline-flex items-center justify-center gap-2"
                      >
                        <WalletIcon size={15} /> View Wallet &amp; Top-Ups
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Print Job Specs (5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="card p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                    <Printer size={13} className="text-accent" /> Print Job Specifications
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-line">
                      <span className="text-ink-muted">Document</span>
                      <span className="font-medium text-ink truncate max-w-[180px]" title={order.document?.originalName}>
                        {order.document?.originalName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-line">
                      <span className="text-ink-muted">Pages &amp; Copies</span>
                      <span className="font-semibold text-ink">
                        {order.totalPages} pages · {order.copies} {order.copies > 1 ? 'copies' : 'copy'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-ink-muted">Configuration</span>
                      <span className="font-semibold text-ink">
                        {order.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {order.paperSize} · {order.sides === 'DOUBLE' ? '2-sided' : '1-sided'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <Sparkles size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    <strong>Why use Ink Wallet?</strong> Wallet orders bypass manual payment verification queues and start printing immediately.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* PAYMENT METHOD VIEW 2: UPI PAYMENT */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: QR Code & Mobile Launch (7 Cols) */}
              <div className="lg:col-span-7 card p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-line pb-3.5">
                  <span className="text-sm font-bold text-ink flex items-center gap-2">
                    <QrCode size={18} className="text-accent" />
                    Scan QR with Any UPI App
                  </span>
                  <span className="text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                    <Sparkles size={12} /> Instant UPI
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border-2 border-line/80 shadow-sm max-w-sm mx-auto">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`UPI QR Code for ${merchantName}`}
                      width={260}
                      height={260}
                      className="rounded-xl mx-auto shadow-2xs"
                    />
                  ) : (
                    <div className="w-[260px] h-[260px] flex flex-col items-center justify-center gap-2 text-xs text-ink-muted">
                      <RefreshCw size={26} className="animate-spin text-accent" />
                      <span>Generating QR Code...</span>
                    </div>
                  )}
                  <p className="text-[11px] text-ink-muted mt-3 text-center">
                    Point your phone's camera or open Google Pay, PhonePe, Paytm, or BHIM
                  </p>
                </div>

                {/* Mobile Quick Intent Button */}
                <div className="space-y-2">
                  <a
                    href={upiUri}
                    className="btn btn-primary text-xs sm:text-sm w-full py-3.5 inline-flex items-center justify-center gap-2.5 shadow-md shadow-accent/20"
                  >
                    <Smartphone size={18} />
                    Pay via UPI App (GPay / PhonePe / Paytm / CRED)
                  </a>
                  <p className="text-[11px] text-ink-muted text-center">
                    Supported: Google Pay, PhonePe, Paytm, CRED, BHIM, Amazon Pay &amp; all Bank UPI Apps.
                  </p>
                </div>

                {/* Copyable Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-line text-left">
                  <div className="p-3.5 rounded-2xl bg-paper border border-line">
                    <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">Merchant UPI VPA</span>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-mono text-xs font-bold text-ink truncate mr-2">
                        {merchantUpiId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyVpa}
                        className="p-1.5 rounded-lg hover:bg-paper-hover text-ink-muted hover:text-ink transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedVpa ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-paper border border-line">
                    <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider block">Exact Amount</span>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold text-accent font-display">
                        ₹{totalStr}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAmount}
                        className="p-1.5 rounded-lg hover:bg-paper-hover text-ink-muted hover:text-ink transition-colors"
                        title="Copy Amount"
                      >
                        {copiedAmount ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Step 2 Submission, Status & Order Specs (5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Step 2: Confirm Payment Card */}
                <div className="card p-6 sm:p-7 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      <span className="h-5 w-5 rounded-md bg-accent text-white flex items-center justify-center text-[10px] font-bold">
                        2
                      </span>
                      Step 2: Confirm Payment
                    </h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      After completing the transfer in your UPI app, submit below to alert the print operator.
                    </p>
                  </div>

                  <form onSubmit={handleSubmitUtr} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        UPI Reference / UTR Number <span className="text-ink-muted font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 423456789012 (12-digit ref)"
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-line rounded-xl text-xs sm:text-sm font-mono text-ink outline-none focus:ring-2 focus:ring-accent/15 bg-white"
                      />
                      <p className="text-[11px] text-ink-muted mt-1">
                        12-digit transaction reference shown on GPay / PhonePe / Paytm receipt.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingUtr}
                      className="btn btn-primary text-xs sm:text-sm w-full py-3 inline-flex items-center justify-center gap-2 shadow-sm font-semibold"
                    >
                      {submittingUtr ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} /> I Have Paid — Submit for Verification
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Live Verification Status Card */}
                <div className="card p-5 space-y-3 bg-paper-sunken/60 border-line">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-500" /> Verification Status
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchOrderAndSettings(false)}
                      disabled={isRefreshing}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                      {isRefreshing ? 'Checking...' : 'Check Status'}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-line flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Current Status:</span>
                    <span className="font-semibold text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                      Pending Verification
                    </span>
                  </div>

                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    The admin will verify your payment against their merchant account statement and confirm your order for printing.
                  </p>
                </div>

                {/* Order Job Specifications Recap */}
                <div className="card p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                    <Printer size={13} className="text-accent" /> Print Job Specifications
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-line">
                      <span className="text-ink-muted">Document</span>
                      <span className="font-medium text-ink truncate max-w-[180px]" title={order.document?.originalName}>
                        {order.document?.originalName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-line">
                      <span className="text-ink-muted">Pages &amp; Copies</span>
                      <span className="font-semibold text-ink">
                        {order.totalPages} pages · {order.copies} {order.copies > 1 ? 'copies' : 'copy'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-ink-muted">Configuration</span>
                      <span className="font-semibold text-ink">
                        {order.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {order.paperSize} · {order.sides === 'DOUBLE' ? '2-sided' : '1-sided'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security & Guarantee Note */}
                <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-900 text-xs flex items-start gap-2.5">
                  <ShieldCheck size={18} className="text-teal-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    Official Inks Cloud Print Hub. Your documents will be printed immediately upon payment confirmation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
