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
} from 'lucide-react';

const STATUS_STEPS = ['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED'];
const STATUS_LABELS = {
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  PRINTED: 'Printed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function StatusTimeline({ status }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="relative flex flex-col items-center">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-line text-ink-muted'}
                ${active ? 'ring-4 ring-teal-100 shadow-sm' : ''}
              `}>
                {done ? <CheckCircle size={16} /> : <span>{idx + 1}</span>}
              </div>
              <span className={`mt-1.5 text-[10px] font-semibold whitespace-nowrap ${done ? 'text-teal-800' : 'text-ink-muted'}`}>
                {STATUS_LABELS[step]}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 ${idx < currentIdx ? 'bg-teal-500' : 'bg-line'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StarRating({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => !disabled && setHover(0)}
          className={`transition-transform focus:outline-none ${!disabled ? 'hover:scale-115 cursor-pointer' : 'cursor-default'}`}
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

  // Deliver state
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);

  // Feedback state
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [featureSuggestion, setFeatureSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isStaff = user && STAFF_ROLES.includes(user.role);

  useEffect(() => {
    async function loadScan() {
      try {
        const data = await api.get(`/scan/${token}`);
        setOrder(data.order);
        setHasFeedback(Boolean(data.hasFeedback));
        setExistingFeedback(data.feedback);
        if (data.isDelivered) setDelivered(true);
      } catch (err) {
        setError(err.message || 'QR code not found or expired');
      } finally {
        setLoading(false);
      }
    }
    loadScan();
  }, [token]);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function handleUpdateStatus(newStatus) {
    if (!window.confirm(`Update order ${order.orderNumber} status to ${newStatus}?`)) return;
    setUpdatingStatus(true);
    try {
      await api.post(`/scan/${token}/status`, { status: newStatus });
      setOrder((prev) => ({ ...prev, orderStatus: newStatus }));
      if (newStatus === 'DELIVERED') setDelivered(true);
    } catch (err) {
      alert(err.message || `Failed to update status to ${newStatus}`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeliver() {
    return handleUpdateStatus('DELIVERED');
  }

  async function handleFeedback(e) {
    e.preventDefault();
    if (!rating && !message.trim()) {
      alert('Please provide a star rating or feedback comment.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/scan/${token}/feedback`, { rating, message, featureSuggestion });
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
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-ink-muted text-sm font-medium">Verifying order QR code...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">QR Code Invalid</h1>
            <p className="text-ink-muted text-xs mt-1">{error || 'This order was not found or the link has expired.'}</p>
          </div>
          <Link to="/" className="btn btn-secondary text-xs w-full py-2.5 inline-block">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const isDelivered = delivered || order.orderStatus === 'DELIVERED';
  const showFeedbackSubmitted = hasFeedback || submitted;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/70 via-paper to-indigo-50/50 py-8 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-lg w-full space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <Link to="/" className="inline-flex items-center gap-1.5 font-display text-2xl font-bold text-ink hover:text-accent transition-colors">
            inks<span className="text-accent">.</span>
          </Link>
          <p className="text-xs text-ink-muted font-medium">Inks by Trackify</p>
        </div>

        {/* Order Card */}
        <div className="card shadow-pop bg-white border border-line rounded-3xl overflow-hidden p-6 sm:p-7 space-y-6">
          
          {/* Order Title & Status */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-line">
            <div>
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded-full">
                Print Order
              </span>
              <h2 className="text-xl font-display font-bold text-ink mt-1 font-mono">{order.orderNumber}</h2>
              <p className="text-xs text-ink-muted">{order.customer}</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                isDelivered
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-teal-100 text-teal-800 border border-teal-200'
              }`}>
                {isDelivered ? <CheckCircle size={13} /> : <Clock size={13} />}
                {order.orderStatus}
              </span>
              <p className="text-[11px] text-ink-muted mt-1">{formatDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Live Timeline */}
          <div className="py-2">
            <StatusTimeline status={order.orderStatus} />
          </div>

          {/* Document Specifications */}
          <div className="p-4 rounded-2xl bg-paper-sunken/70 border border-line space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted flex items-center gap-1.5">
                <FileText size={14} className="text-accent" /> Document:
              </span>
              <span className="font-semibold text-ink truncate max-w-[200px]">{order.documentName}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-2">
              <span className="text-ink-muted">Configuration:</span>
              <span className="font-medium text-ink">
                {order.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {order.paperSize} · {order.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} · {order.sides === 'DOUBLE' ? 'Double sided' : 'Single sided'}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-2">
              <span className="text-ink-muted">Quantity &amp; Pages:</span>
              <span className="font-medium text-ink">
                {order.copies} {order.copies === 1 ? 'copy' : 'copies'} · {order.totalPages} pages
              </span>
            </div>
            {order.binding && order.binding !== 'none' && (
              <div className="flex items-center justify-between border-t border-line/60 pt-2">
                <span className="text-ink-muted">Binding:</span>
                <span className="font-medium text-ink capitalize">{order.binding}</span>
              </div>
            )}
          </div>

          {/* ── STAFF ZONE: Order Status Controls ── */}
          {isStaff && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 via-indigo-50 to-purple-50 border border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer size={17} className="text-teal-700" />
                  <span className="text-xs font-bold text-teal-900">Staff Operations · Update Status</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md">
                  {user.role}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('PROCESSING')}
                  disabled={updatingStatus || order.orderStatus === 'PROCESSING'}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    order.orderStatus === 'PROCESSING'
                      ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
                      : 'bg-white border-line hover:border-amber-400 text-ink hover:bg-amber-50/50'
                  }`}
                >
                  <Clock size={14} className={order.orderStatus === 'PROCESSING' ? 'text-amber-600' : 'text-ink-muted'} />
                  <span>Processing</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus('PRINTED')}
                  disabled={updatingStatus || order.orderStatus === 'PRINTED'}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    order.orderStatus === 'PRINTED'
                      ? 'bg-purple-100 border-purple-300 text-purple-800 shadow-xs'
                      : 'bg-white border-line hover:border-purple-400 text-ink hover:bg-purple-50/50'
                  }`}
                >
                  <Printer size={14} className={order.orderStatus === 'PRINTED' ? 'text-purple-600' : 'text-ink-muted'} />
                  <span>Printed</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus('DELIVERED')}
                  disabled={updatingStatus || order.orderStatus === 'DELIVERED'}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    order.orderStatus === 'DELIVERED'
                      ? 'bg-green-100 border-green-300 text-green-800 shadow-xs'
                      : 'bg-white border-line hover:border-green-400 text-ink hover:bg-green-50/50'
                  }`}
                >
                  <Truck size={14} className={order.orderStatus === 'DELIVERED' ? 'text-green-600' : 'text-ink-muted'} />
                  <span>Delivered</span>
                </button>
              </div>

              {order.orderStatus === 'DELIVERED' ? (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-center">
                  <p className="text-xs font-bold text-green-800 flex items-center justify-center gap-1.5">
                    <CheckCircle size={14} className="text-green-600" /> Completed &amp; Delivered
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* ── CUSTOMER FEEDBACK & SUGGESTION SECTION ── */}
          <div className="border-t border-line pt-6 space-y-4">
            {showFeedbackSubmitted ? (
              <div className="p-5 rounded-2xl bg-green-50/80 border border-green-200 text-center space-y-3 animate-scale-in">
                <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
                  <ThumbsUp size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-green-900">Thank You for Your Feedback!</h3>
                  <p className="text-xs text-green-800 mt-1 leading-relaxed">
                    Your rating and suggestions help us continuously improve our print quality and fast delivery.
                  </p>
                </div>
                {existingFeedback?.rating && (
                  <div className="flex justify-center pt-1">
                    <StarRating value={existingFeedback.rating} onChange={() => {}} disabled />
                  </div>
                )}
                {existingFeedback?.message && (
                  <p className="text-xs italic text-green-900 bg-white/80 p-3 rounded-xl border border-green-200/60 max-w-sm mx-auto text-left">
                    "{existingFeedback.message}"
                  </p>
                )}
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

                <div className="flex justify-center py-2">
                  <StarRating value={rating} onChange={setRating} />
                </div>

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
                  className="w-full btn btn-primary py-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
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
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-ink-muted">
          Powered by <strong className="text-ink font-semibold">Inks by Trackify</strong> · Professional Print &amp; Delivery
        </p>
      </div>
    </div>
  );
}
