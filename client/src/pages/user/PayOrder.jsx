import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, invoiceUrl } from '../../lib/api';
import { formatMoney, formatDateTime, formatDate } from '../../lib/format';
import { useToast } from '../../components/Toaster';
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
  ChevronRight
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
        api.get('/settings/pricing').catch(() => ({ pricing: null }))
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

  // Live poll every 5 seconds if order is pending verification
  useEffect(() => {
    if (!order || order.paymentStatus === 'PAID') return;

    const interval = setInterval(() => {
      fetchOrderAndSettings(true);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.paymentStatus, orderId]);

  const merchantUpiId = pricing?.merchantUpiId || 'trackify@icici';
  const merchantName = pricing?.merchantName || 'Inks by Trackify';

  // Construct standard UPI deep-link URI
  const totalStr = order ? Number(order.totalAmount).toFixed(2) : '0.00';
  const orderNum = order?.orderNumber || `Order-${orderId}`;
  const upiUri = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(merchantName)}&am=${totalStr}&tn=${encodeURIComponent(`Inks ${orderNum}`)}&cu=INR`;

  // Generate QR code 100% locally via canvas (Offline-safe, CSP compliant)
  useEffect(() => {
    if (!order) return;
    QRCode.toDataURL(upiUri, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
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
      <div className="max-w-2xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-10 bg-line rounded-xl w-1/3"></div>
        <div className="h-64 bg-line rounded-2xl"></div>
        <div className="h-40 bg-line rounded-2xl"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto p-8 card text-center space-y-4 my-12">
        <AlertTriangle size={36} className="text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-ink">Order Not Found</h2>
        <p className="text-xs text-ink-muted">The requested print order could not be located.</p>
        <Link to="/user/print" className="btn btn-primary text-xs">
          Go to Print Hub
        </Link>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';
  const isFailed = order.paymentStatus === 'FAILED';
  const isPending = order.paymentStatus === 'PENDING';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Link to="/user/orders" className="hover:text-ink transition-colors">
          My Orders
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink font-medium">Order #{order.orderNumber}</span>
      </div>

      {/* SUCCESS STATE — PAYMENT VERIFIED */}
      {isPaid && (
        <div className="card p-8 text-center space-y-5 bg-gradient-to-b from-green-50/80 via-white to-white border-green-200 shadow-pop animate-scale-in">
          <div className="h-16 w-16 rounded-2xl bg-green-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-green-600/20">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
              Payment Verified &amp; Confirmed
            </span>
            <h1 className="text-2xl font-display font-bold text-ink mt-3">
              Order Confirmed for Printing!
            </h1>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              Your UPI payment of <strong>{formatMoney(order.totalAmount)}</strong> has been verified by the desk. An official Tax Invoice PDF has been sent to your email.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-paper border border-line max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-ink-muted">Order Number</span>
              <span className="font-mono font-bold text-accent">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Document</span>
              <span className="font-medium text-ink truncate max-w-[200px]">
                {order.document?.originalName || 'Print Document'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Total Paid</span>
              <span className="font-bold text-green-700">{formatMoney(order.totalAmount)}</span>
            </div>
            {order.upiRefNumber && (
              <div className="flex justify-between">
                <span className="text-ink-muted">UPI UTR / Ref</span>
                <span className="font-mono text-ink">{order.upiRefNumber}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={invoiceUrl(order.id)}
              download={`Invoice-${order.orderNumber}.pdf`}
              className="btn btn-primary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
            >
              <Download size={15} /> Download Tax Invoice (PDF)
            </a>
            <Link
              to={`/user/orders?track=${order.orderNumber}`}
              className="btn btn-secondary text-xs w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
            >
              <FileText size={15} /> Track Print Progress
            </Link>
          </div>
        </div>
      )}

      {/* PENDING / FAILED PAYMENT STATE */}
      {!isPaid && (
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="card p-6 bg-gradient-to-r from-accent-soft/40 via-paper to-white border-accent/15">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                  UPI Payment &amp; Verification
                </span>
                <h1 className="text-2xl font-display font-bold text-ink mt-0.5">
                  Complete Payment for Order #{order.orderNumber}
                </h1>
                <p className="text-xs text-ink-muted mt-1">
                  Scan the QR code or click the UPI button on mobile to pay with any UPI app.
                </p>
              </div>

              <div className="text-right self-start sm:self-center">
                <span className="text-[11px] font-semibold text-ink-muted uppercase">Amount Payable</span>
                <div className="text-3xl font-display font-bold text-accent">
                  {formatMoney(order.totalAmount)}
                </div>
              </div>
            </div>

            {/* Rejection Alert if payment failed */}
            {isFailed && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>⚠️ Previous verification could not be confirmed</strong>
                  <p className="mt-0.5">
                    Reason: <em>{order.paymentRejectReason || 'Payment not received in merchant account'}</em>.
                  </p>
                  <p className="text-[11px] text-rose-700 mt-1">
                    Please pay using the QR code below and submit your payment confirmation.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Col: QR Code & Mobile Launch (7 cols) */}
            <div className="md:col-span-7 card p-6 text-center space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <QrCode size={16} className="text-accent" />
                  Scan QR with any UPI App
                </span>
                <span className="text-[11px] text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  Instant UPI
                </span>
              </div>

              {/* QR Code Container (Local canvas-generated) */}
              <div className="p-4 bg-white rounded-2xl border-2 border-line/80 inline-block shadow-sm min-h-[260px] min-w-[260px]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`UPI QR Code for ${merchantName}`}
                    width={240}
                    height={240}
                    className="rounded-lg mx-auto"
                  />
                ) : (
                  <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-2 text-xs text-ink-muted">
                    <RefreshCw size={24} className="animate-spin text-accent" />
                    <span>Generating local QR...</span>
                  </div>
                )}
              </div>

              {/* Mobile Quick Intent Button (shown prominently on mobile) */}
              <div className="space-y-2">
                <a
                  href={upiUri}
                  className="btn btn-primary text-sm w-full py-3 inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-shadow"
                >
                  <Smartphone size={18} />
                  ⚡ Pay via UPI App (GPay / PhonePe / Paytm / CRED)
                </a>
                <p className="text-[11px] text-ink-muted">
                  Supported: Google Pay, PhonePe, Paytm, CRED, BHIM, Amazon Pay &amp; Banking apps.
                </p>
              </div>

              {/* Copyable Details */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-line text-left">
                <div className="p-3 rounded-xl bg-paper border border-line">
                  <span className="text-[10px] text-ink-muted uppercase font-semibold block">Merchant UPI VPA</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-xs font-bold text-ink truncate mr-2">
                      {merchantUpiId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="p-1 rounded hover:bg-paper-hover text-ink-muted hover:text-ink transition-colors"
                      title="Copy UPI ID"
                    >
                      {copiedVpa ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-paper border border-line">
                  <span className="text-[10px] text-ink-muted uppercase font-semibold block">Exact Amount</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold text-accent">
                      ₹{totalStr}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAmount}
                      className="p-1 rounded hover:bg-paper-hover text-ink-muted hover:text-ink transition-colors"
                      title="Copy Amount"
                    >
                      {copiedAmount ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Payment Submission & Live Status (5 cols) */}
            <div className="md:col-span-5 space-y-6">
              {/* Submission Form */}
              <div className="card p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Step 2: Confirm Payment
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    After completing the transfer in your UPI app, click below to notify the printing desk.
                  </p>
                </div>

                <form onSubmit={handleSubmitUtr} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      UPI Reference / UTR Number <span className="text-ink-muted font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 423456789012"
                      className="input text-xs font-mono w-full"
                      maxLength={30}
                    />
                    <p className="text-[10px] text-ink-muted mt-1">
                      12-digit transaction reference shown on GPay / PhonePe / Paytm receipt.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingUtr}
                    className="btn btn-primary text-xs w-full py-2.5 inline-flex items-center justify-center gap-1.5"
                  >
                    {submittingUtr ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Check size={15} /> I Have Paid — Submit for Verification
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Status Polling Live Box */}
              <div className="card p-5 bg-paper/60 border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-500 animate-spin" />
                    Verification Status
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchOrderAndSettings(true)}
                    disabled={isRefreshing}
                    className="text-[11px] text-accent hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} /> Check Status
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white border border-line text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Status</span>
                    <span className="font-semibold text-amber-600">Pending Verification</span>
                  </div>
                  {order.upiRefNumber && (
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Submitted Ref</span>
                      <span className="font-mono text-ink">{order.upiRefNumber}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-ink-muted pt-1 border-t border-line">
                    The admin will verify your payment against their merchant account statement and confirm your order for printing.
                  </p>
                </div>
              </div>

              {/* Safety notice */}
              <div className="flex items-start gap-2.5 text-[11px] text-ink-muted px-1">
                <ShieldCheck size={16} className="text-green-600 shrink-0 mt-0.5" />
                <p>
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
