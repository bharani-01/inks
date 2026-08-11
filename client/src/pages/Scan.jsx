import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import {
  CheckCircle,
  Star,
  Clock,
  Send,
  AlertCircle,
  ThumbsUp,
  Lightbulb,
  FileText,
  MessageSquare,
  Sparkles,
  Printer,
  ChevronRight,
} from 'lucide-react';

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
          aria-label={`Rate ${star} stars`}
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

export default function Scan() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [error, setError] = useState(null);

  // Feedback form state
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [featureSuggestion, setFeatureSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
              <span className="text-[11px] font-bold text-accent uppercase tracking-wider bg-accent-soft px-2.5 py-0.5 rounded-full">
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
              {existingFeedback?.featureSuggestion && (
                <p className="text-xs text-emerald-800 bg-white/80 p-3 rounded-xl border border-emerald-200/60 max-w-sm mx-auto text-left">
                  <strong>Feature Suggestion:</strong> {existingFeedback.featureSuggestion}
                </p>
              )}
              <div className="pt-2 flex justify-center gap-2">
                <Link to="/user/print" className="btn btn-sm btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5">
                  <Printer size={13} /> Print Another Document
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
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-ink-muted">
          Powered by <strong className="text-ink font-semibold">Inks by Trackify</strong> · Skip the Queue
        </p>
      </div>
    </div>
  );
}
