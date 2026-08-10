import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Eye, Share2, PackageOpen, Plus, Download } from 'lucide-react';
import { api, invoiceUrl } from '../../lib/api.js';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format.js';
import { statusBadge } from '../../lib/status.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import TrackingStepper from '../../components/user/TrackingStepper.jsx';

const LIMIT = 10;

function StatusBadge({ status }) {
  const b = statusBadge(status);
  return <span className={`badge ${b.badge}`}>{b.label}</span>;
}

export default function Orders() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = useCallback(async (p) => {
    setLoading(true);
    try {
      const data = await api.get(`/orders/my-orders?page=${p}&limit=${LIMIT}`);
      setOrders(data.orders || []);
      setPagination(data.pagination || { page: p, total: 0, totalPages: 0 });
    } catch {
      toast('Failed to load your orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOrders(page);
  }, [page, loadOrders]);

  const openDetail = useCallback(async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api.get(`/orders/${id}`);
      setDetail(data.order);
    } catch {
      toast('Failed to load order details', 'error');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  // ?track=PRT-xxx deep link → resolve via the public endpoint, then open detail.
  useEffect(() => {
    const code = searchParams.get('track');
    if (!code) return;
    (async () => {
      try {
        const data = await api.get(`/orders/track/${encodeURIComponent(code)}`);
        if (data?.order?.id) openDetail(data.order.id);
        else toast(`Order ${code} not found`, 'error');
      } catch {
        toast(`Order ${code} not found`, 'error');
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete('track');
        setSearchParams(next, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function shareTrackLink(orderNumber) {
    const url = `${window.location.origin}/track/${orderNumber}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Public tracking link copied to clipboard', 'success');
    } catch {
      toast('Copy failed — link: ' + url, 'info');
    }
  }

  return (
    <div className="max-w-content mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">My orders</h1>
          <p className="text-ink-muted mt-1">Track everything you've sent to print.</p>
        </div>
        <Link to="/user/print" className="btn btn-primary hidden sm:inline-flex">
          <Plus size={18} /> New order
        </Link>
      </div>

      {loading ? (
        <PageLoader label="Loading your orders…" />
      ) : orders.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={PackageOpen}
            title="No orders yet"
            description="Once you place a print order it'll show up here, with live tracking."
            action={
              <Link to="/user/print" className="btn btn-primary">
                <Plus size={18} /> Start printing
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wide border-b border-line">
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3">Specs</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => openDetail(o.id)}
                  className="cursor-pointer hover:bg-paper-hover transition-colors"
                >
                  <td className="px-5 py-3 font-semibold text-ink whitespace-nowrap">{o.orderNumber}</td>
                  <td className="px-5 py-3 max-w-[180px]">
                    <span className="block truncate text-ink-soft">
                      {o.document ? o.document.originalName : 'File'}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`badge ${o.colorMode === 'COLOR' ? 'badge-accent' : 'badge-neutral'}`}>
                      {o.colorMode === 'COLOR' ? 'Colour' : 'B&W'}
                    </span>
                    <span className="ml-2 text-xs text-ink-muted">
                      {o.copies}× {o.paperSize}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-ink whitespace-nowrap">
                    {formatMoney(o.totalAmount)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={o.orderStatus} />
                  </td>
                  <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(o.id);
                      }}
                      className="text-ink-muted hover:text-accent"
                      aria-label={`View ${o.orderNumber}`}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="md:hidden divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => openDetail(o.id)}
                  className="w-full text-left px-4 py-4 hover:bg-paper-hover transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{o.orderNumber}</p>
                      <p className="text-xs text-ink-muted">{formatDate(o.createdAt)}</p>
                    </div>
                    <StatusBadge status={o.orderStatus} />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft truncate">
                    {o.document ? o.document.originalName : 'Uploaded file'}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-ink-muted">
                      {o.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · {o.copies}× {o.paperSize}
                    </span>
                    <span className="font-semibold text-ink">{formatMoney(o.totalAmount)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="px-5 py-4 border-t border-line">
            <Pagination
              page={pagination.page}
              total={pagination.total}
              totalPages={pagination.totalPages}
              limit={LIMIT}
              onPage={setPage}
              ellipsis
            />
          </div>
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail ? `Order ${detail.orderNumber}` : 'Order details'}
        size="lg"
        footer={
          detail && (
            <>
              {detail.paymentStatus === 'PAID' ? (
                <a
                  href={invoiceUrl(detail.id)}
                  download={`Invoice-${detail.orderNumber}.pdf`}
                  className="btn btn-secondary inline-flex items-center gap-1.5"
                >
                  <Download size={16} /> Download Invoice (PDF)
                </a>
              ) : (
                <Link
                  to={`/user/pay/${detail.id}`}
                  className="btn btn-primary inline-flex items-center gap-1.5 bg-accent text-white"
                >
                  Pay via UPI / Submit UTR &rarr;
                </Link>
              )}
              <Button variant="secondary" onClick={() => shareTrackLink(detail.orderNumber)}>
                <Share2 size={16} /> Share
              </Button>
              <Link to="/user/print" className="btn btn-primary" onClick={() => setDetailOpen(false)}>
                <Plus size={16} /> New order
              </Link>
            </>
          )
        }
      >
        {detailLoading || !detail ? (
          <PageLoader label="Loading…" />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <FileTypeIcon mimeType={detail.document?.mimeType} size={20} boxed />
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">
                    {detail.document ? detail.document.originalName : 'Document'}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDateTime(detail.createdAt)}</p>
                </div>
              </div>
              <StatusBadge status={detail.orderStatus} />
            </div>

            <div className="rounded-xl border border-line bg-paper-sunken px-4 py-5">
              <TrackingStepper status={detail.orderStatus} />
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <DetailRow label="Colour" value={detail.colorMode === 'COLOR' ? 'Full colour' : 'Black & white'} />
              <DetailRow label="Paper size" value={detail.paperSize} />
              <DetailRow label="Sides" value={detail.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'} />
              <DetailRow label="Copies" value={detail.copies} />
              <DetailRow label="Binding" value={<span className="capitalize">{detail.binding}</span>} />
              <DetailRow label="Page range" value={detail.pageRange} />
            </dl>

            {detail.instructions && (
              <div className="rounded-xl bg-paper-sunken border border-line p-3 text-sm">
                <p className="text-xs text-ink-muted mb-1">Special instructions</p>
                <p className="text-ink whitespace-pre-wrap">{detail.instructions}</p>
              </div>
            )}

            <div className="rounded-xl bg-paper-sunken border border-line p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Subtotal</span>
                <span className="text-ink">{formatMoney(detail.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">GST</span>
                <span className="text-ink">{formatMoney(detail.tax)}</span>
              </div>
              <div className="flex justify-between pt-2 mt-1 border-t border-line">
                <span className="font-display font-semibold text-ink">Total paid</span>
                <span className="font-display font-bold text-accent">{formatMoney(detail.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-line pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
