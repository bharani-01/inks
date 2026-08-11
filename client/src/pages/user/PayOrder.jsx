import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, invoiceUrl } from '../../lib/api';
import { formatMoney, formatDateTime, formatDate, formatFileSize } from '../../lib/format';
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
} from 'lucide-react';

export default function PayOrder() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const fetchOrderAndSettings = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const [orderRes, pricingRes] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get('/settings/pricing').catch(() => ({ pricing: null })),
      ]);

      const o = orderRes.order || orderRes;
      setOrder(o);
      if (o?.upiRefNumber) {
        setUtrInput(o.upiRefNumber);
      }
      if (pricingRes?.pricing) {
        setPricing(pricingRes.pricing);
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
              Payment Confirmed
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink pt-1">
              Order Confirmed for Printing!
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Your UPI payment of <strong className="text-ink">{formatMoney(order.totalAmount)}</strong> has been verified. The print station is preparing your document now.
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
              <span className="text-ink-muted">Total Paid</span>
              <span className="font-bold text-green-700 font-display">{formatMoney(order.totalAmount)}</span>
            </div>
            {order.upiRefNumber && (
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
                  Step 1 &amp; 2 · UPI Payment &amp; Verification
                </span>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink pt-1">
                  Complete Payment for Order #{order.orderNumber}
                </h1>
                <p className="text-xs sm:text-sm text-ink-muted max-w-xl">
                  Scan the dynamic QR code with any UPI app on your phone, or tap the button to pay directly.
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
                    Please transfer using the QR code below and submit your 12-digit UTR number.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Main 2-Column Grid */}
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
        </div>
      )}
    </div>
  );
}
