import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Printer,
  Search,
  Eye,
  FileText,
  Clock,
  CheckCircle2,
  Check,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  ExternalLink,
  QrCode,
  Filter,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { api, previewUrl, printReadyUrl, coverPageUrl } from '../../lib/api.js';
import { formatDate, formatDateTime, formatFileSize } from '../../lib/format.js';
import { statusBadge } from '../../lib/status.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import TrackingStepper from '../../components/user/TrackingStepper.jsx';
import ScanQrModal from '../../components/ScanQrModal.jsx';
import { usePrinterAccessibility } from '../../context/PrinterAccessibilityContext.jsx';

const LIMIT = 15;

function StatusBadge({ status }) {
  const b = statusBadge(status);
  return <span className={`badge ${b.badge}`}>{b.label}</span>;
}

export default function PrinterOrders() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: 'unprinted' (default) | 'completed' | 'all'
  const currentTab = searchParams.get('tab') || 'unprinted';

  const {
    settings: a11y,
    contrastClass,
    numeralWeightClass,
    t,
  } = usePrinterAccessibility();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [paperFilter, setPaperFilter] = useState('');

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // Scan modal
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const setTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
    setPage(1);
  };

  const loadOrders = useCallback(async (p, isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(LIMIT));

      // Filter by tab group on backend
      if (currentTab === 'unprinted') {
        params.set('status', 'UNPRINTED');
      } else if (currentTab === 'completed') {
        params.set('status', 'COMPLETED');
      }

      if (search.trim()) params.set('search', search.trim());
      if (colorFilter) params.set('colorMode', colorFilter);

      const data = await api.get(`/orders/admin/all?${params.toString()}`);
      setOrders(data.orders || []);
      setPagination(data.pagination || { page: p, total: (data.orders || []).length, totalPages: 1 });
    } catch (err) {
      toast('Failed to load print queue', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentTab, search, colorFilter, toast]);

  useEffect(() => {
    loadOrders(page);
  }, [page, currentTab, loadOrders]);

  // Live polling for new orders every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => loadOrders(page, true), 15000);
    return () => clearInterval(interval);
  }, [page, loadOrders]);

  // Update order status (e.g. Mark as PRINTED or DELIVERED)
  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await api.put(`/orders/admin/${orderId}/status`, { orderStatus: newStatus });
      toast(`Order #${orderId} marked as ${newStatus}!`, 'success');
      loadOrders(page, true);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, orderStatus: newStatus }));
      }
    } catch (err) {
      toast(err.message || 'Failed to update order status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetail = (order) => {
    setSelectedOrder(order);
    setModalOpen(true);
  };

  const tablePaddingClass =
    a11y.density === 'spacious' ? 'px-4 py-3 sm:px-5 sm:py-3.5' : a11y.density === 'compact' ? 'px-3 py-1.5' : 'px-3.5 py-2.5';

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-fade-in w-full transition-all duration-150">
      {/* Header with Quick A-/A+ Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4.5 rounded-2xl border border-line shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-lg sm:text-xl tracking-tight text-ink">
              {t('queueFulfillment')}
            </h1>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" title="Live Print Queue Polling" />
          </div>
          <p className="text-ink-muted text-xs mt-0.5">
            {t('queueDesc')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadOrders(page, true)}
            disabled={refreshing}
            className="btn btn-secondary text-xs h-8 px-2.5 inline-flex items-center gap-1 rounded-xl cursor-pointer"
            title="Refresh order queue"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? t('syncing') : t('sync')}</span>
          </button>

          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="btn btn-primary text-xs h-8 px-3 inline-flex items-center gap-1.5 rounded-xl font-bold shadow-xs cursor-pointer"
          >
            <QrCode size={14} />
            <span>{t('scanQr')}</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-line pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('unprinted')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
            currentTab === 'unprinted'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-ink-muted hover:text-ink hover:bg-paper-hover'
          }`}
        >
          <Clock size={13} />
          <span>{t('activeQueue')}</span>
          {currentTab === 'unprinted' && pagination.total > 0 && (
            <span className="bg-white text-teal-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {pagination.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
            currentTab === 'completed'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-ink-muted hover:text-ink hover:bg-paper-hover'
          }`}
        >
          <CheckCircle2 size={13} />
          <span>{t('printedDelivered')}</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
            currentTab === 'all'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-ink-muted hover:text-ink hover:bg-paper-hover'
          }`}
        >
          <Layers size={13} />
          <span>{t('allJobs')}</span>
        </button>
      </div>

      {/* Quick Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="field-input pl-8 h-8 text-xs w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="field-select h-8 text-xs py-0.5"
          >
            <option value="">{t('allColors')}</option>
            <option value="COLOR">{t('fullColor')}</option>
            <option value="BW">{t('bwMode')}</option>
          </select>
        </div>
      </div>

      {/* Main Print Orders Table */}
      {loading && orders.length === 0 ? (
        <PageLoader label="Loading print queue…" />
      ) : orders.length === 0 ? (
        <div className={`card ${contrastClass} p-10 bg-white`}>
          <EmptyState
            title={currentTab === 'unprinted' ? t('queueClearTitle') : t('noOrdersFound')}
            description={
              currentTab === 'unprinted'
                ? t('queueClearDesc')
                : t('noOrdersDesc')
            }
          />
        </div>
      ) : (
        <div className={`card ${contrastClass} bg-white overflow-hidden border border-line shadow-xs`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-sunken text-ink-muted uppercase tracking-wider font-semibold border-b border-line text-[11px]">
                <tr>
                  <th className="px-3.5 py-2">{t('orderNumber')}</th>
                  <th className="px-3.5 py-2">{t('document')}</th>
                  <th className="px-3.5 py-2">{t('customer')}</th>
                  <th className="px-3.5 py-2">{t('specifications')}</th>
                  <th className="px-3.5 py-2">{t('printedSheets')}</th>
                  <th className="px-3.5 py-2">Status</th>
                  <th className="px-3.5 py-2 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => {
                  const totalSheets = (o.totalPages || 1) * (o.copies || 1);
                  const isUnprinted = o.orderStatus === 'RECEIVED' || o.orderStatus === 'PROCESSING';

                  return (
                    <tr
                      key={o.id}
                      onClick={() => openDetail(o)}
                      className={`cursor-pointer transition-colors ${
                        isUnprinted ? 'bg-amber-50/20 hover:bg-amber-50/60' : 'hover:bg-paper-hover'
                      }`}
                    >
                      {/* Order Number */}
                      <td className={tablePaddingClass}>
                        <div className="flex items-center gap-1.5">
                          {isUnprinted && <span className="h-2 w-2 rounded-full bg-amber-500" title={t('needsPrint')} />}
                          <span className="font-mono font-bold text-ink">{o.orderNumber}</span>
                        </div>
                        <span className="text-[10px] text-ink-muted block mt-0.5">{formatDate(o.createdAt)}</span>
                      </td>

                      {/* Document Name */}
                      <td className={`${tablePaddingClass} max-w-[200px]`}>
                        <div className="flex items-center gap-2">
                          <FileTypeIcon mimeType={o.document?.mimeType} size={14} />
                          <span className="truncate font-semibold text-ink" title={o.document?.originalName}>
                            {o.document?.originalName || t('document')}
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-muted">
                          {o.document?.pageCount ? `${o.document.pageCount} pages · ` : ''}
                          {formatFileSize(o.document?.fileSize || 0)}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className={tablePaddingClass}>
                        <p className="font-bold text-ink truncate max-w-[130px]">{o.user?.name || t('customer')}</p>
                        <p className="text-[10px] text-ink-muted truncate max-w-[130px] font-mono">{o.user?.email}</p>
                      </td>

                      {/* Specifications */}
                      <td className={tablePaddingClass}>
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`badge text-[10px] font-bold ${
                              o.colorMode === 'COLOR'
                                ? 'bg-amber-100 text-amber-900 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {o.colorMode === 'COLOR' ? t('colorMode') : t('bwMode')}
                          </span>
                          <span className="badge badge-neutral text-[10px]">{o.paperSize}</span>
                          <span className="badge badge-neutral text-[10px]">{o.sides === 'DOUBLE' ? '2-Sided' : '1-Sided'}</span>
                          {o.binding && o.binding !== 'none' && (
                            <span className="badge bg-teal-100 text-teal-800 border-teal-200 text-[10px] font-bold">
                              {o.binding}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Sheets Calculation */}
                      <td className={tablePaddingClass}>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-base text-ink tabular-nums ${numeralWeightClass}`}>{totalSheets}</span>
                          <span className="text-[10px] text-ink-muted">{t('sheets')}</span>
                        </div>
                        <span className="text-[10px] text-ink-muted">
                          ({o.copies}× {o.totalPages}p)
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className={tablePaddingClass} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={o.orderStatus}
                          onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          className="field-select text-[11px] py-0.5 font-semibold rounded-lg"
                        >
                          <option value="RECEIVED">Received</option>
                          <option value="PROCESSING">Processing</option>
                          <option value="PRINTED">Printed</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                        {o.printedBy ? (
                          <span className="text-[10px] text-teal-800 font-medium block mt-0.5">
                            {t('byPrinter', { name: o.printedBy.name })}
                          </span>
                        ) : null}
                      </td>

                      {/* Quick Action Buttons */}
                      <td className={`${tablePaddingClass} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          {/* 1. Print Ready PDF (1st & Last Cover Auto-Attached) */}
                          <a
                            href={printReadyUrl(o.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs h-7 px-2 inline-flex items-center gap-1 font-bold shadow-xs rounded-lg"
                            title="Open Print-Ready Document with 1st & Last Cover Pages"
                          >
                            <Printer size={11} /> {t('printCoverAttached')}
                          </a>

                          {/* 2. Raw Document */}
                          {o.document?.id && (
                            <a
                              href={previewUrl(o.document.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary text-xs h-7 px-1.5 inline-flex items-center gap-1 rounded-lg text-ink-soft hover:text-ink"
                              title="Preview Raw Original Document without cover"
                            >
                              <Eye size={11} /> {t('rawPreview')}
                            </a>
                          )}

                          {/* 3. Mark as Printed Button */}
                          {isUnprinted && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(o.id, 'PRINTED')}
                              disabled={updatingId === o.id}
                              className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 inline-flex items-center gap-1 font-bold shadow-xs rounded-lg cursor-pointer"
                              title="Mark document as physically printed"
                            >
                              <Check size={11} strokeWidth={3} />
                              <span>{t('markPrinted')}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-3.5 py-2.5 border-t border-line">
            <Pagination
              page={pagination.page}
              total={pagination.total}
              totalPages={pagination.totalPages}
              limit={LIMIT}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <Modal
        open={modalOpen && !!selectedOrder}
        onClose={() => setModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Printer size={17} className="text-teal-600" />
            <span>Order #{selectedOrder?.orderNumber} Specifications</span>
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <a
                href={selectedOrder ? printReadyUrl(selectedOrder.id) : '#'}
                target="_blank"
                rel="noreferrer"
                className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 px-3 inline-flex items-center gap-1.5 font-bold shadow-xs"
              >
                <Printer size={14} /> {t('printCoverAttached')}
              </a>

              {selectedOrder?.document?.id && (
                <a
                  href={previewUrl(selectedOrder.document.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary text-xs h-8 px-3 inline-flex items-center gap-1.5"
                >
                  <Eye size={14} /> {t('rawPreview')}
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedOrder && selectedOrder.orderStatus !== 'PRINTED' && selectedOrder.orderStatus !== 'DELIVERED' && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(selectedOrder.id, 'PRINTED');
                    setModalOpen(false);
                  }}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 inline-flex items-center gap-1 font-bold"
                >
                  <Check size={14} /> {t('markPrinted')}
                </button>
              )}
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-4">
            {/* Primary Action Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Printer size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink">Print-Ready Document Package</h4>
                  <p className="text-[11px] text-ink-muted">Includes Front Cover + Document + Feedback Cover Page</p>
                </div>
              </div>
              <a
                href={printReadyUrl(selectedOrder.id)}
                target="_blank"
                rel="noreferrer"
                className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 px-3.5 inline-flex items-center gap-1.5 rounded-lg shadow-xs shrink-0"
              >
                <Printer size={14} /> Open Print-Ready PDF
              </a>
            </div>

            {/* Print Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-paper-sunken border border-line">
                <span className="text-[10px] text-ink-muted uppercase font-bold block">Color Mode</span>
                <span className="font-bold text-ink text-sm">
                  {selectedOrder.colorMode === 'COLOR' ? t('colorMode') : t('bwMode')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-paper-sunken border border-line">
                <span className="text-[10px] text-ink-muted uppercase font-bold block">Paper Size</span>
                <span className="font-bold text-ink text-sm">{selectedOrder.paperSize}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-paper-sunken border border-line">
                <span className="text-[10px] text-ink-muted uppercase font-bold block">Sides</span>
                <span className="font-bold text-ink text-sm">
                  {selectedOrder.sides === 'DOUBLE' ? '2-Sided (Duplex)' : '1-Sided (Single)'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-paper-sunken border border-line">
                <span className="text-[10px] text-ink-muted uppercase font-bold block">Copies</span>
                <span className="font-bold text-ink text-sm">{selectedOrder.copies}</span>
              </div>
            </div>

            {/* Sheets Breakdown & Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-line space-y-1.5">
                <span className="font-bold text-ink block">{t('customer')} Information</span>
                <p className="text-ink-soft font-semibold">{selectedOrder.user?.name || t('customer')}</p>
                <p className="text-ink-muted font-mono text-[11px]">{selectedOrder.user?.email}</p>
              </div>

              <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 space-y-1">
                <span className="font-bold text-teal-950 block">Calculated Paper Volume</span>
                <p className="text-xl font-bold font-display text-teal-900">
                  {(selectedOrder.totalPages || 1) * (selectedOrder.copies || 1)} Total Sheets
                </p>
                <p className="text-[11px] text-teal-800">
                  {selectedOrder.copies} copies &times; {selectedOrder.totalPages} pages per copy
                </p>
              </div>
            </div>

            {selectedOrder.instructions && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                <span className="font-bold text-amber-950 block mb-0.5">Customer Instructions:</span>
                <p className="text-amber-900">{selectedOrder.instructions}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ScanQrModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onSuccess={() => loadOrders(page, true)}
      />
    </div>
  );
}
