import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
            <div className={`
              relative flex flex-col items-center
            `}>
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-line text-ink-muted'}
                ${active ? 'ring-4 ring-teal-100' : ''}
              `}>
                {done ? <CheckCircle size={16} /> : <span>{idx + 1}</span>}
              </div>
              <span className={`mt-1.5 text-[10px] font-medium whitespace-nowrap ${done ? 'text-teal-700' : 'text-ink-muted'}`}>
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

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            size={32}
            className={`transition-colors ${
              star <= (hover || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-line fill-line'
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
  const [tokenUsed, setTokenUsed] = useState(false);
  const [error, setError] = useState(null);

  // Deliver state
  const [delivering, setDelivering] = useState(false);
  const [delivered, setDelivered] = useState(false);

  // Feedback state
  const [rating, setRating] = useState(0);
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
        setTokenUsed(data.tokenUsed);
      } catch (err) {
        setError(err.message || 'QR code not found or expired');
      } finally {
        setLoading(false);
      }
    }
    loadScan();
  }, [token]);

  async function handleDeliver() {
    if (!window.confirm(`Mark order ${order.orderNumber} as DELIVERED?`)) return;
    setDelivering(true);
    try {
      await api.post(`/scan/${token}/deliver`, {});
      setDelivered(true);
    } catch (err) {
      alert(err.message || 'Failed to mark as delivered');
    } finally {
      setDelivering(false);
    }
  }

  async function handleFeedback(e) {
    e.preventDefault();
    if (!rating && !message.trim()) {
      alert('Please provide a rating or a message.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/scan/${token}/feedback`, { rating, message, featureSuggestion });
      setSubmitted(true);
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
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted text-sm">Loading order information...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-rose-500" />
          </div>
          <h1 className="text-xl font-bold text-ink mb-2">QR Code Not Found</h1>
          <p className="text-ink-muted text-sm">{error}</p>
          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-xs text-ink-muted">Inks by Trackify</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Already Used ──
  if (tokenUsed && !delivered && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-ink mb-2">QR Already Used</h1>
          <p className="text-ink-muted text-sm">
            This QR code has already been redeemed and is no longer valid.
          </p>
          <div className="mt-4 bg-slate-50 rounded-xl p-3 text-left">
            <p className="text-xs text-ink-muted">Order</p>
            <p className="text-sm font-semibold text-ink">{order?.orderNumber}</p>
          </div>
          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-xs text-ink-muted">Inks by Trackify</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Staff view: Delivered success ──
  if (delivered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck size={36} className="text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-teal-700 mb-2">Delivered!</h1>
          <p className="text-ink-muted text-sm">
            Order <strong>{order?.orderNumber}</strong> has been marked as delivered. The customer has been notified.
          </p>
          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-xs text-ink-muted">Inks by Trackify — Printer Operations</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Customer feedback: Success ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsUp size={36} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Thank you!</h1>
          <p className="text-ink-muted text-sm">
            Your feedback helps us improve. We appreciate you choosing Inks by Trackify!
          </p>
          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-xs text-ink-muted">Inks by Trackify</p>
          </div>
        </div>
      </div>
    );
  }

  // ── STAFF VIEW ──
  if (isStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <Printer size={20} />
              <span className="text-sm font-medium opacity-80">Printer Admin Panel</span>
            </div>
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <p className="text-teal-100 text-sm mt-0.5">{order.customer}</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Status timeline */}
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Order Progress</p>
              <StatusTimeline status={order.orderStatus} />
            </div>

            {/* Order details */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Document</span>
                <span className="font-medium text-ink text-right max-w-[60%] truncate">{order.documentName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Print Mode</span>
                <span className="font-medium text-ink">
                  {order.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {order.sides === 'DOUBLE' ? 'Double' : 'Single'} sided
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Paper</span>
                <span className="font-medium text-ink">{order.paperSize}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Copies</span>
                <span className="font-medium text-ink">{order.copies} x {order.totalPages} pages</span>
              </div>
              {order.binding && order.binding !== 'none' && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Binding</span>
                  <span className="font-medium text-ink capitalize">{order.binding}</span>
                </div>
              )}
            </div>

            {/* Special instructions */}
            {order.instructions && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Special Instructions</p>
                <p className="text-sm text-amber-800">{order.instructions}</p>
              </div>
            )}

            {/* Deliver CTA */}
            {order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'CANCELLED' ? (
              <button
                type="button"
                onClick={handleDeliver}
                disabled={delivering}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-teal-200"
              >
                {delivering ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Marking as delivered...
                  </>
                ) : (
                  <>
                    <Truck size={20} />
                    Mark as Delivered
                  </>
                )}
              </button>
            ) : (
              <div className="w-full bg-slate-100 text-slate-500 font-semibold py-4 rounded-2xl text-base text-center flex items-center justify-center gap-2">
                <CheckCircle size={20} />
                {order.orderStatus === 'DELIVERED' ? 'Already Delivered' : 'Order Cancelled'}
              </div>
            )}
          </div>

          <div className="px-6 pb-5 text-center">
            <p className="text-xs text-ink-muted">Inks by Trackify — Printer Operations</p>
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOMER FEEDBACK VIEW ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Package size={28} />
          </div>
          <h1 className="text-2xl font-bold">How was your print?</h1>
          <p className="text-indigo-100 text-sm mt-1">Order {order.orderNumber}</p>
        </div>

        <form onSubmit={handleFeedback} className="p-6 space-y-5">
          {/* Star rating */}
          <div className="text-center">
            <p className="text-sm font-semibold text-ink mb-3">Rate your experience</p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={setRating} />
            </div>
            {rating > 0 && (
              <p className="text-xs text-ink-muted mt-2">
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'][rating]}
              </p>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">
              Your feedback <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your experience — print quality, speed, service..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-line rounded-xl text-sm text-ink placeholder:text-ink-muted focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
            />
          </div>

          {/* Feature suggestion */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-amber-500" />
              Feature suggestion <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <textarea
              value={featureSuggestion}
              onChange={(e) => setFeatureSuggestion(e.target.value)}
              placeholder="Any features or improvements you'd like to see?"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-line rounded-xl text-sm text-ink placeholder:text-ink-muted focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-200"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Feedback
              </>
            )}
          </button>
        </form>

        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-ink-muted">Thank you for choosing Inks by Trackify</p>
        </div>
      </div>
    </div>
  );
}
