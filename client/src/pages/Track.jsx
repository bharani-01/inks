import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { PackageSearch, AlertTriangle, ArrowRight, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { statusBadge } from '../lib/status.js';
import { PageLoader } from '../components/States.jsx';
import Logo from '../components/Logo.jsx';
import FileTypeIcon from '../components/FileTypeIcon.jsx';
import TrackingStepper from '../components/user/TrackingStepper.jsx';

function StatusBadge({ status }) {
  const b = statusBadge(status);
  return <span className={`badge ${b.badge}`}>{b.label}</span>;
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink text-right">{value}</dd>
    </div>
  );
}

/**
 * Public order-tracking page (no login required). Reachable at /track/:orderNumber
 * or /track?track=CODE. Reads the PUBLIC GET /orders/track/:orderNumber endpoint,
 * so anyone with a shared link can see live status without an account. Financial
 * totals are intentionally omitted from this public view.
 */
export default function Track() {
  const { orderNumber: routeCode } = useParams();
  const [params] = useSearchParams();
  const code = (routeCode || params.get('track') || params.get('code') || '').trim();

  const [query, setQuery] = useState(code);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!code);
  const [error, setError] = useState(code ? '' : 'empty');

  useEffect(() => {
    setQuery(code);
    if (!code) {
      setLoading(false);
      setError('empty');
      setOrder(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await api.get(`/orders/track/${encodeURIComponent(code)}`);
        if (active) setOrder(data.order);
      } catch (err) {
        if (active) setError(err.message || 'Order not found');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-paper [overflow-x:clip]">
      <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white/90 backdrop-blur border-b border-line">
        <Logo />
        <Link to="/login" className="btn btn-secondary btn-sm">
          Sign in <ArrowRight size={14} />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 text-center">
          <span className="h-12 w-12 mx-auto rounded-2xl bg-accent-soft text-accent inline-flex items-center justify-center">
            <PackageSearch size={26} />
          </span>
          <h1 className="mt-3 font-display font-bold text-2xl sm:text-3xl tracking-tight">Track your order</h1>
          <p className="text-ink-muted mt-1">
            {code ? (
              <>Live status for <span className="font-semibold text-ink">{code}</span>.</>
            ) : (
              'Enter the order code (like PRT-XXXXXX-XXX) to see its status.'
            )}
          </p>
        </div>

        {/* Lookup form — shown when no code, or when the lookup failed. */}
        {(error === 'empty' || (error && error !== 'empty')) && (
          <form
            action="/track"
            method="get"
            className="card p-4 sm:p-5 mb-5 flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <input
                type="text"
                name="track"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="PRT-971027-842"
                aria-label="Order code"
                className="field-input pl-9 w-full"
              />
            </div>
            <button type="submit" className="btn btn-primary shrink-0 w-full sm:w-auto">
              Track order
            </button>
          </form>
        )}

        {loading ? (
          <PageLoader label="Looking up your order…" />
        ) : error && error !== 'empty' ? (
          <div className="card p-8 text-center">
            <span className="h-12 w-12 mx-auto rounded-2xl bg-danger-soft text-danger inline-flex items-center justify-center">
              <AlertTriangle size={24} />
            </span>
            <h2 className="mt-3 font-display font-semibold text-lg text-ink">We couldn't find that order</h2>
            <p className="text-sm text-ink-muted mt-1">
              Double-check the code and try again — order codes look like <span className="font-medium text-ink">PRT-XXXXXX-XXX</span>.
            </p>
          </div>
        ) : order ? (
          <div className="space-y-5">
            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileTypeIcon mimeType={order.document?.mimeType} size={20} boxed />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {order.document ? order.document.originalName : 'Document'}
                    </p>
                    <p className="text-xs text-ink-muted">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>
                <StatusBadge status={order.orderStatus} />
              </div>
              <div className="mt-5 rounded-xl border border-line bg-paper-sunken px-4 py-5">
                <TrackingStepper status={order.orderStatus} />
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                <DetailRow label="Order" value={order.orderNumber} />
                {order.user?.name && <DetailRow label="Placed by" value={order.user.name} />}
                <DetailRow label="Colour" value={order.colorMode === 'COLOR' ? 'Full colour' : 'Black & white'} />
                <DetailRow label="Paper size" value={order.paperSize} />
                <DetailRow label="Orientation" value={order.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} />
                <DetailRow label="Sides" value={order.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'} />
                <DetailRow label="Copies" value={order.copies} />
                <DetailRow label="Binding" value={<span className="capitalize">{order.binding}</span>} />
                <DetailRow label="Pages" value={order.pageRange} />
              </dl>
              <p className="mt-4 text-xs text-ink-muted">
                Collect at the print desk once the status shows <span className="font-medium text-ink">Printed</span>.
              </p>
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-ink-muted">
          Want to place your own order?{' '}
          <Link to="/register" className="font-semibold text-accent hover:text-accent-hover">
            Create an account
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
