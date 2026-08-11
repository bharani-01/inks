import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import {
  CheckCircle,
  Star,
  Package,
  Printer,
  Clock,
  Send,
  Truck,
  AlertCircle,
  ThumbsUp,
  Lightbulb,
  FileText,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  User,
  ExternalLink,
  LogIn,
} from 'lucide-react';

const STATUS_STEPS = ['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED'];
const STATUS_LABELS = {
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  PRINTED: 'Printed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function StatusTimeline({ status = 'RECEIVED' }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx && currentIdx !== -1;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="relative flex flex-col items-center">
              <div
                className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${
                  done
                    ? 'bg-accent border-accent text-white'
                    : 'bg-white border-line text-ink-muted'
                }
                ${active ? 'ring-4 ring-accent-soft shadow-xs' : ''}
              `}
              >
                {done ? <CheckCircle size={15} /> : <span>{idx + 1}</span>}
              </div>
              <span
                className={`mt-1 text-[10px] font-semibold whitespace-nowrap ${
                  done ? 'text-accent font-bold' : 'text-ink-muted'
                }`}
              >
                {STATUS_LABELS[step] || step}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 ${
                  idx < currentIdx ? 'bg-accent' : 'bg-line'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StarRating({ value = 5, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange && onChange(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => !disabled && setHover(0)}
          className={`transition-transform focus:outline-none ${
            !disabled ? 'hover:scale-115 cursor-pointer' : 'cursor-default'
          }`}
        >
          <Star
            size={36}
            className={`transition-colors ${
              star <= (hover || value)
                ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                : 'text-gray-200 fill-gray-100'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const STAFF_ROLES = ['ADMIN', 'PRINTER_ADMIN'];

export default function Scan() {
  const { token } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [error, setError] = useState(null);

  // Staff status state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusSuccessMessage, setStatusSuccessMessage] = useState(null);

  // Feedback state
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [featureSuggestion, setFeatureSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isStaff = Boolean(user && STAFF_ROLES.includes(user?.role));

  useEffect(() => {
    let isMounted = true;
    async function loadScan() {
      if (!token) {
        if (isMounted) {
          setError('No QR code token provided');
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await api.get(`/scan/${encodeURIComponent(token)}`);
        if (isMounted) {
          if (data && data.order) {
            setOrder(data.order);
            setHasFeedback(Boolean(data.hasFeedback));
            setExistingFeedback(data.feedback || null);
          } else {
            setError('Order information could not be retrieved.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'QR code not found or expired');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadScan();
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleUpdateStatus(newStatus) {
    if (!order || !token) return;
    if (!window.confirm(`Update order #${order.orderNumber} status to ${newStatus}?`)) return;
    setUpdatingStatus(true);
    setStatusSuccessMessage(null);
    try {
      await api.post(`/scan/${encodeURIComponent(token)}/status`, { status: newStatus });
      setOrder((prev) => (prev ? { ...prev, orderStatus: newStatus } : prev));
      setStatusSuccessMessage(`Order #${order.orderNumber} status updated to ${newStatus}!`);
      setTimeout(() => setStatusSuccessMessage(null), 4000);
    } catch (err) {
      alert(err.message || `Failed to update status to ${newStatus}`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleFeedback(e) {
    e.preventDefault();
    if (!token) return;
    if (!rating && !message.trim()) {
      alert('Please provide a star rating or feedback comment.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/scan/${encodeURIComponent(token)}/feedback`, {
        rating,
        message: message.trim(),
        featureSuggestion: featureSuggestion.trim(),
      });
      setSubmitted(true);
      setExistingFeedback(res.feedback || { rating, message, featureSuggestion });
    } catch (err) {
      alert(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center p-6">
        <div className="card shadow-pop bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <h2 className="text-base font-bold text-ink">Verifying Order QR Code</h2>
            <p className="text-ink-muted text-xs mt-1">Looking up print order details...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !order) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center p-6">
        <div className="card shadow-pop bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle size={32} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">QR Code Invalid</h1>
            <p className="text-ink-muted text-xs mt-1">
              {error || 'This order was not found or the verification link has expired.'}
            </p>
          </div>
          <Link to="/" className="btn btn-secondary text-xs w-full py-2.5 inline-block text-center">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const isDelivered = order.orderStatus === 'DELIVERED';
  const showFeedbackSubmitted = hasFeedback || submitted;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. STAFF OPERATOR VIEW (Admin / Printer Admin)
  // Focused on Order Fulfillment, Verification & Status Updating
  // ──────────────────────────────────────────────────────────────────────────
  if (isStaff) {
    const adminTargetPath = user?.role === 'ADMIN' ? '/admin/dashboard' : '/printer/orders';
    const ordersTargetPath = user?.role === 'ADMIN' ? '/admin/orders' : '/printer/orders';

    return (
      <div className="min-h-screen bg-gradient-to-br from-paper-sunken via-white to-accent-soft/30 py-8 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-lg w-full space-y-5">
          {/* Brand & Staff Badge */}
          <div className="flex items-center justify-between">
            <Link
              to={adminTargetPath}
              className="inline-flex items-center gap-1.5 font-display text-2xl font-bold text-ink hover:text-accent transition-colors"
            >
              inks<span className="text-accent">.</span>
            </Link>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-bold shadow-2xs">
              <ShieldCheck size={14} />
              <span>Operator Terminal ({user?.role || 'Staff'})</span>
            </div>
          </div>

          {/* Main Staff Card */}
          <div className="card shadow-pop bg-white border border-line rounded-3xl overflow-hidden p-6 sm:p-7 space-y-6">
            {/* Header: Order info */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-line">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider bg-accent-soft px-2.5 py-0.5 rounded-full">
                  Fulfillment Scan
                </span>
                <h2 className="text-xl font-display font-bold text-ink mt-1 font-mono">{order.orderNumber || 'Order'}</h2>
                <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                  <User size={13} /> {order.customer || 'Customer'}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    isDelivered
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-accent-soft text-accent border border-accent/20'
                  }`}
                >
                  {isDelivered ? <CheckCircle size={13} /> : <Clock size={13} />}
                  {order.orderStatus || 'RECEIVED'}
                </span>
                <p className="text-[11px] text-ink-muted mt-1">{formatDate(order.createdAt)}</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="py-2">
              <StatusTimeline status={order.orderStatus || 'RECEIVED'} />
            </div>

            {/* Document Specifications */}
            <div className="p-4 rounded-2xl bg-paper-sunken border border-line space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted flex items-center gap-1.5">
                  <FileText size={14} className="text-accent" /> Document:
                </span>
                <span className="font-semibold text-ink truncate max-w-[200px]">{order.documentName || 'Document'}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line/60 pt-2">
                <span className="text-ink-muted">Configuration:</span>
                <span className="font-medium text-ink">
                  {order.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {order.paperSize || 'A4'} ·{' '}
                  {order.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} ·{' '}
                  {order.sides === 'DOUBLE' ? 'Double sided' : 'Single sided'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-line/60 pt-2">
                <span className="text-ink-muted">Copies &amp; Pages:</span>
                <span className="font-medium text-ink">
                  {order.copies || 1} {order.copies === 1 ? 'copy' : 'copies'} · {order.totalPages || 1} total pages
                </span>
              </div>
              {order.binding && order.binding !== 'none' && (
                <div className="flex items-center justify-between border-t border-line/60 pt-2">
                  <span className="text-ink-muted">Binding:</span>
                  <span className="font-medium text-ink capitalize">{order.binding}</span>
                </div>
              )}
            </div>

            {/* Success Message Banner */}
            {statusSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800 animate-scale-in">
                ✓ {statusSuccessMessage}
              </div>
            )}

            {/* Staff Status Action Controls */}
            <div className="p-4 rounded-2xl bg-paper-sunken/80 border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Printer size={15} className="text-accent" /> Quick Status Update:
                </span>
                <span className="text-[10px] text-ink-muted">Tap to transition status</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('PROCESSING')}
                  disabled={updatingStatus || order.orderStatus === 'PROCESSING'}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    order.orderStatus === 'PROCESSING'
                      ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
                      : 'bg-white border-line hover:border-amber-400 text-ink hover:bg-amber-50/50'
                  }`}
                >
                  <Clock size={15} className={order.orderStatus === 'PROCESSING' ? 'text-amber-600' : 'text-ink-muted'} />
                  <span>Processing</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus('PRINTED')}
                  disabled={updatingStatus || order.orderStatus === 'PRINTED'}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    order.orderStatus === 'PRINTED'
                      ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
                      : 'bg-white border-line hover:border-purple-400 text-ink hover:bg-purple-50/50'
                  }`}
                >
                  <Printer size={15} className={order.orderStatus === 'PRINTED' ? 'text-purple-600' : 'text-ink-muted'} />
                  <span>Printed</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus('DELIVERED')}
                  disabled={updatingStatus || order.orderStatus === 'DELIVERED'}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    order.orderStatus === 'DELIVERED'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-xs'
                      : 'bg-white border-line hover:border-emerald-400 text-ink hover:bg-emerald-50/50'
                  }`}
                >
                  <Truck size={15} className={order.orderStatus === 'DELIVERED' ? 'text-emerald-600' : 'text-ink-muted'} />
                  <span>Delivered</span>
                </button>
              </div>
            </div>

            {/* Customer Feedback Review (For Staff) */}
            {existingFeedback && (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <Star size={13} className="text-amber-500 fill-amber-500" /> Customer Rating:
                  </span>
                  <span className="font-bold text-amber-800">{existingFeedback.rating || 5} / 5 Stars</span>
                </div>
                {existingFeedback.message && (
                  <p className="text-xs text-amber-900 italic bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                    "{existingFeedback.message}"
                  </p>
                )}
                {existingFeedback.featureSuggestion && (
                  <p className="text-xs text-amber-800 bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                    <strong>Suggestion:</strong> {existingFeedback.featureSuggestion}
                  </p>
                )}
              </div>
            )}

            {/* Operator Return Action */}
            <div className="pt-2">
              <Link
                to={ordersTargetPath}
                className="w-full btn btn-secondary py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <ChevronRight size={14} /> Return to Orders Management
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CUSTOMER / STUDENT VIEW
  // 100% Focused on Experience Feedback & Star Rating Form
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-paper-sunken via-white to-accent-soft/30 py-8 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-md w-full space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-display text-2xl font-bold text-ink hover:text-accent transition-colors"
          >
            inks<span className="text-accent">.</span>
          </Link>
          <p className="text-xs text-ink-muted font-medium">Inks by Trackify · Customer Experience</p>
        </div>

        {/* Feedback Card */}
        <div className="card shadow-pop bg-white border border-line rounded-3xl overflow-hidden p-6 sm:p-7 space-y-6">
          {/* Order Summary Strip */}
          <div className="p-4 rounded-2xl bg-paper-sunken border border-line space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-accent uppercase tracking-wider bg-accent-soft px-2 py-0.5 rounded-full">
                Print Order #{order.orderNumber || 'Order'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isDelivered
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-accent-soft text-accent'
                }`}
              >
                {isDelivered ? <CheckCircle size={12} /> : <Clock size={12} />}
                {order.orderStatus || 'RECEIVED'}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-2">
              <span className="text-ink-muted">Document:</span>
              <span className="font-semibold text-ink truncate max-w-[180px]">{order.documentName || 'Document'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-2">
              <span className="text-ink-muted">Pages &amp; Copies:</span>
              <span className="font-medium text-ink">
                {order.totalPages || 1} pages · {order.copies || 1} {order.copies === 1 ? 'copy' : 'copies'}
              </span>
            </div>
          </div>

          {/* Customer Feedback Form or Thank You confirmation */}
          {showFeedbackSubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-scale-in">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <ThumbsUp size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">Thank You for Your Feedback!</h3>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Your review and suggestions help us deliver the fastest, crispest prints for all students.
                </p>
              </div>
              {existingFeedback?.rating && (
                <div className="flex justify-center pt-1">
                  <StarRating value={existingFeedback.rating} onChange={() => {}} disabled />
                </div>
              )}
              {existingFeedback?.message && (
                <p className="text-xs italic text-emerald-900 bg-white/80 p-3 rounded-xl border border-emerald-200/60 max-w-sm mx-auto text-left">
                  "{existingFeedback.message}"
                </p>
              )}
              <div className="pt-2">
                <Link to="/user/print" className="btn btn-sm btn-primary text-xs px-4 py-2 inline-block">
                  Print Another Document
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleFeedback} className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-display font-bold text-ink flex items-center justify-center gap-2">
                  <Sparkles size={17} className="text-amber-500" /> Rate Your Print Quality
                </h3>
                <p className="text-xs text-ink-muted">
                  How was your printing experience with Inks by Trackify?
                </p>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center py-2">
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-ink-muted" /> Review &amp; Comments:
                </label>
                <textarea
                  rows={2}
                  placeholder="Tell us about the print clarity, speed, or paper quality..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none resize-none transition-all"
                />
              </div>

              {/* Feature Suggestion */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                  <Lightbulb size={13} className="text-amber-500" /> Feature Suggestion (Optional):
                </label>
                <textarea
                  rows={2}
                  placeholder="What new feature, binding style, or option would you love to see next?"
                  value={featureSuggestion}
                  onChange={(e) => setFeatureSuggestion(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none resize-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn btn-primary py-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting Feedback...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Submit Feedback &amp; Suggestions
                  </>
                )}
              </button>
            </form>
          )}

          {/* Operator Quick Switcher (If an admin is scanning from regular device without login) */}
          {!isStaff && (
            <div className="pt-2 border-t border-line text-center">
              <Link
                to="/login"
                className="text-[11px] text-ink-muted hover:text-accent font-medium inline-flex items-center gap-1 transition-colors"
              >
                <LogIn size={12} /> Printing Staff / Administrator? Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-ink-muted">
          Powered by <strong className="text-ink font-semibold">Inks by Trackify</strong> · Skip the Queue
        </p>
      </div>
    </div>
  );
}
