import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import { EmptyState } from '../../components/States';
import {
  Star,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  Users,
  BarChart2,
  Filter,
  RefreshCw,
  Package,
  User,
  Calendar,
} from 'lucide-react';

/* ─── Star display helper ─── */
function Stars({ rating, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-line fill-line'}
        />
      ))}
    </div>
  );
}

/* ─── Stat card ─── */
function StatCard({ icon: Icon, label, value, sub, colorClass }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl shrink-0 ${colorClass}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="text-2xl font-display font-bold text-ink mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-ink-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Rating distribution bar ─── */
function RatingBar({ star, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1 w-14 shrink-0">
        <span className="font-medium text-ink">{star}</span>
        <Star size={11} className="text-amber-400 fill-amber-400" />
      </div>
      <div className="flex-1 bg-line rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-ink-muted w-8 text-right">{count}</span>
    </div>
  );
}

/* ─── Feedback card ─── */
function FeedbackCard({ fb }) {
  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0">
            {fb.order?.user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">
              {fb.order?.user?.name || 'Anonymous'}
            </p>
            <p className="text-xs text-ink-muted truncate">{fb.order?.user?.email}</p>
          </div>
        </div>
        {fb.rating ? (
          <div className="shrink-0 text-right">
            <Stars rating={fb.rating} size={15} />
            <p className="text-[11px] text-ink-muted mt-0.5">{ratingLabels[fb.rating]}</p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted bg-paper-sunken px-2 py-1 rounded-lg shrink-0">
            No rating
          </span>
        )}
      </div>

      {/* Order info */}
      <div className="flex items-center gap-4 text-xs text-ink-muted bg-paper-sunken rounded-xl px-3 py-2">
        <span className="flex items-center gap-1.5">
          <Package size={12} />
          {fb.order?.orderNumber}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar size={12} />
          {new Date(fb.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </span>
      </div>

      {/* Feedback message */}
      {fb.message && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare size={13} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">Feedback</span>
          </div>
          <p className="text-sm text-ink leading-relaxed">{fb.message}</p>
        </div>
      )}

      {/* Feature suggestion */}
      {fb.featureSuggestion && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-700">Feature Suggestion</span>
          </div>
          <p className="text-sm text-ink leading-relaxed">{fb.featureSuggestion}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [ratingFilter, setRatingFilter] = useState('');
  const [page, setPage] = useState(1);

  const toast = useToast();

  const load = useCallback(async (p = 1, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 12 });
      const data = await api.get(`/feedback?${params.toString()}`);
      setFeedback(data.feedback || []);
      setPagination(data.pagination || null);
      setStats(data.stats || null);
    } catch (err) {
      toast('Failed to load feedback', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(page); }, [load, page]);

  // Client-side rating filter (data already loaded)
  const filtered = ratingFilter
    ? feedback.filter((fb) => fb.rating === parseInt(ratingFilter))
    : feedback;

  const avgRating = stats?.averageRating;
  const totalFeedback = stats?.totalFeedback ?? 0;
  const ratedCount = stats?.ratedCount ?? 0;
  const featureSuggestions = feedback.filter((fb) => fb.featureSuggestion).length;

  // Build distribution map
  const distMap = {};
  (stats?.ratingDistribution || []).forEach(({ rating, _count }) => {
    distMap[rating] = _count.rating;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink flex items-center gap-2.5">
            <MessageSquare size={22} className="text-accent" />
            Customer Feedback
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Reviews and suggestions collected via QR code scans after order delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(page, true)}
          disabled={refreshing}
          className="btn btn-secondary flex items-center gap-2 shrink-0"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Total Responses"
          value={totalFeedback}
          sub="QR codes redeemed"
          colorClass="bg-indigo-100 text-indigo-700"
        />
        <StatCard
          icon={Star}
          label="Average Rating"
          value={avgRating ? avgRating.toFixed(1) : '—'}
          sub={ratedCount ? `from ${ratedCount} ratings` : 'No ratings yet'}
          colorClass="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={Lightbulb}
          label="Feature Ideas"
          value={featureSuggestions}
          sub="on this page"
          colorClass="bg-teal-100 text-teal-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Satisfaction"
          value={avgRating ? `${Math.round((avgRating / 5) * 100)}%` : '—'}
          sub="based on ratings"
          colorClass="bg-green-100 text-green-700"
        />
      </div>

      {/* Rating distribution + filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution card */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-accent" />
            Rating Distribution
          </h2>
          {ratedCount === 0 ? (
            <p className="text-xs text-ink-muted text-center py-4">No ratings yet</p>
          ) : (
            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar
                  key={star}
                  star={star}
                  count={distMap[star] || 0}
                  total={ratedCount}
                />
              ))}
            </div>
          )}
        </div>

        {/* Filter card */}
        <div className="card p-5 flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Filter size={16} className="text-accent" />
            Filter Feedback
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRatingFilter('')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                ratingFilter === ''
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-ink border-line hover:border-accent hover:text-accent'
              }`}
            >
              All
            </button>
            {[5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRatingFilter(ratingFilter === String(s) ? '' : String(s))}
                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  ratingFilter === String(s)
                    ? 'bg-amber-400 text-white border-amber-400'
                    : 'bg-white text-ink border-line hover:border-amber-300'
                }`}
              >
                {s} <Star size={11} className={ratingFilter === String(s) ? 'fill-white' : 'fill-amber-400 text-amber-400'} />
                <span className="text-[10px] opacity-70 ml-0.5">({distMap[s] || 0})</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRatingFilter('no-rating')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                ratingFilter === 'no-rating'
                  ? 'bg-slate-600 text-white border-slate-600'
                  : 'bg-white text-ink border-line hover:border-slate-400'
              }`}
            >
              No Rating
            </button>
          </div>

          {/* Feature suggestions toggle */}
          <div className="mt-auto pt-3 border-t border-line">
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-amber-600">{featureSuggestions}</span> entries on this page include feature suggestions.
              Filter by rating to narrow results.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback list */}
      {loading && feedback.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No feedback yet"
          description={
            ratingFilter
              ? 'No feedback matches the selected rating filter.'
              : 'Customer feedback will appear here after orders are delivered and customers scan the QR code on their cover page.'
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of{' '}
              <span className="font-semibold text-ink">{totalFeedback}</span> responses
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((fb) => (
              <FeedbackCard key={fb.id} fb={fb} />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!ratingFilter && pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(p) => { setPage(p); load(p); }}
        />
      )}
    </div>
  );
}
