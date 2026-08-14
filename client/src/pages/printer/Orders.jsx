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
  Download,
  BookOpen,
  ArrowRight,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { api, previewUrl, printReadyUrl, coverPageUrl, invoiceUrl } from '../../lib/api.js';
import { formatDate, formatDateTime, formatFileSize } from '../../lib/format.js';
import { statusBadge } from '../../lib/status.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import ScanQrModal from '../../components/ScanQrModal.jsx';
import { usePrinterAccessibility } from '../../context/PrinterAccessibilityContext.jsx';

const LIMIT = 15;

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

  // Update order status
  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await api.put(`/orders/admin/${orderId}/status`, { orderStatus: newStatus });
      toast(`Order marked as ${newStatus}!`, 'success');
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
    a11y.density === 'spacious' ? 'px-4 py-3.5' : a11y.density === 'compact' ? 'px-3 py-1.5' : 'px-3.5 py-2.5';

  return (
    <div className="space-y-4 animate-fade-in w-full transition-all duration-150">
      {/* 1. Station Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-line shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-xl tracking-tight text-ink">
              Print Queue &amp; Order Fulfillment
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Station
            </span>
          </div>
          <p className="text-ink-muted text-xs">
            Review pending print jobs, open print-ready PDFs with cover pages, and update order fulfillment status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadOrders(page, true)}
            disabled={refreshing}
            className="btn btn-secondary text-xs h-9 px-3 inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
            title="Refresh order queue"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>{refreshing ? 'Syncing...' : 'Sync Queue'}</span>
          </button>

          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl font-bold shadow-xs cursor-pointer"
          >
            <QrCode size={15} />
            <span>Scan QR Counter</span>
          </button>
        </div>
      </div>

      {/* 2. Status Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('unprinted')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shrink-0 cursor-pointer ${
            currentTab === 'unprinted'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock size={14} />
          <span>Active Queue (Unprinted)</span>
          {currentTab === 'unprinted' && pagination.total > 0 && (
            <span className="bg-white text-teal-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {pagination.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shrink-0 cursor-pointer ${
            currentTab === 'completed'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 size={14} />
          <span>Printed &amp; Delivered</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shrink-0 cursor-pointer ${
            currentTab === 'all'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers size={14} />
          <span>All Jobs</span>
        </button>
      </div>

      {/* 3. Search & Quick Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-line shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order #, Customer, or File Name..."
            className="field-input pl-9 h-9 text-xs w-full bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold pr-1">
            <Filter size={13} className="text-slate-400" />
            <span>Color Filter:</span>
          </div>
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="field-select h-9 text-xs py-0.5 bg-slate-50/50 font-medium"
          >
            <option value="">All Color Modes</option>
            <option value="COLOR">Full Colour (CMYK)</option>
            <option value="BW">Black &amp; White (Monochrome)</option>
          </select>
        </div>
      </div>

      {/* 4. Queue Table */}
      {loading && orders.length === 0 ? (
        <PageLoader label="Loading print queue…" />
      ) : orders.length === 0 ? (
        <div className={`card ${contrastClass} p-10 bg-white text-center`}>
          <EmptyState
            title={currentTab === 'unprinted' ? 'Queue is All Clear!' : 'No Orders Found'}
            description={
              currentTab === 'unprinted'
                ? 'No active unprinted jobs in queue. New print orders will automatically show up here in real-time.'
                : 'No orders match your active tab or search criteria.'
            }
          />
        </div>
      ) : (
        <div className={`card ${contrastClass} bg-white overflow-hidden border border-line shadow-sm rounded-2xl`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-line text-[11px]">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Print Specifications</th>
                  <th className="px-4 py-3">Sheets &amp; Copies</th>
                  <th className="px-4 py-3">Fulfillment Status</th>
                  <th className="px-4 py-3 text-right">Quick Actions</th>
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
                        isUnprinted ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Order Number */}
                      <td className={tablePaddingClass}>
                        <div className="flex items-center gap-2">
                          {isUnprinted && (
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 shrink-0" title="Needs Print" />
                          )}
                          <span className="font-mono font-bold text-indigo-950 text-xs sm:text-sm">{o.orderNumber}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{formatDate(o.createdAt)}</span>
                      </td>

                      {/* Document Name */}
                      <td className={`${tablePaddingClass} max-w-[220px]`}>
                        <div className="flex items-center gap-2.5">
                          <FileTypeIcon mimeType={o.document?.mimeType} size={16} boxed />
                          <div className="min-w-0">
                            <span className="truncate font-bold text-slate-900 block text-xs" title={o.document?.originalName}>
                              {o.document?.originalName || 'Document'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {o.document?.pageCount ? `${o.document.pageCount} pages · ` : ''}
                              {formatFileSize(o.document?.fileSize || 0)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className={tablePaddingClass}>
                        <p className="font-bold text-slate-900 truncate max-w-[130px]">{o.user?.name || 'Customer'}</p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[130px] font-mono">{o.user?.email}</p>
                      </td>

                      {/* Specifications */}
                      <td className={tablePaddingClass}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Color Mode Icon Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1.5 ${
                              o.colorMode === 'COLOR'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {o.colorMode === 'COLOR' ? (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="8" r="5.5" fill="#EC4899" />
                                  <circle cx="8.5" cy="14.5" r="5.5" fill="#06B6D4" />
                                  <circle cx="15.5" cy="14.5" r="5.5" fill="#FBBF24" />
                                </svg>
                                <span>Full Colour</span>
                              </>
                            ) : (
                              <>
                                <span className="h-2 w-2 rounded-full bg-slate-700" />
                                <span>B &amp; W</span>
                              </>
                            )}
                          </span>

                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                            {o.paperSize || 'A4'}
                          </span>

                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                            {o.sides === 'DOUBLE' ? 'Duplex (2-Sided)' : '1-Sided'}
                          </span>

                          {o.binding && o.binding !== 'none' && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-bold uppercase tracking-wider">
                              {o.binding}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Sheets Calculation */}
                      <td className={tablePaddingClass}>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-base font-bold text-slate-900 tabular-nums ${numeralWeightClass}`}>{totalSheets}</span>
                          <span className="text-[11px] text-slate-500 font-medium">sheets</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({o.copies}× {o.totalPages}p)
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className={tablePaddingClass} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={o.orderStatus}
                          onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          disabled={updatingId === o.id}
                          className="field-select text-[11px] py-1 font-bold rounded-xl border-line bg-white shadow-2xs cursor-pointer"
                        >
                          <option value="RECEIVED">Received</option>
                          <option value="PROCESSING">Processing</option>
                          <option value="PRINTED">Printed</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                        {o.printedBy && (
                          <span className="text-[10px] text-teal-800 font-medium block mt-1">
                            By {o.printedBy.name}
                          </span>
                        )}
                      </td>

                      {/* Quick Action Buttons */}
                      <td className={`${tablePaddingClass} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          {/* 1. Print Ready PDF (1st & Last Cover Auto-Attached) */}
                          <a
                            href={printReadyUrl(o.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-2.5 inline-flex items-center gap-1.5 font-bold shadow-xs rounded-xl transition-all"
                            title="Open Print-Ready Document with 1st & Last Cover Pages"
                          >
                            <Printer size={13} />
                            <span>Print PDF</span>
                          </a>

                          {/* 2. Quick Mark as PRINTED */}
                          {o.orderStatus !== 'PRINTED' && o.orderStatus !== 'DELIVERED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(o.id, 'PRINTED')}
                              disabled={updatingId === o.id}
                              className="btn bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs h-8 px-2.5 rounded-xl font-semibold transition-all cursor-pointer"
                              title="Mark order as Printed"
                            >
                              <Check size={14} />
                              <span>Mark Done</span>
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-3 border-t border-line bg-slate-50/50">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* 5. Order Specification Details Modal */}
      {selectedOrder && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Job Specification — #${selectedOrder.orderNumber}`}
          size="md"
        >
          <div className="space-y-4 pt-1">
            {/* Header Specs Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-line space-y-3">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-center gap-3 min-w-0">
                  <FileTypeIcon mimeType={selectedOrder.document?.mimeType} size={22} boxed />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{selectedOrder.document?.originalName}</p>
                    <p className="text-xs text-slate-500">
                      {selectedOrder.document?.pageCount ? `${selectedOrder.document.pageCount} total pages · ` : ''}
                      {formatFileSize(selectedOrder.document?.fileSize || 0)}
                    </p>
                  </div>
                </div>
                <span className="badge badge-neutral text-xs font-mono font-bold">
                  {selectedOrder.orderNumber}
                </span>
              </div>

              {/* Grid Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-line">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Color Mode</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {selectedOrder.colorMode === 'COLOR' ? 'Full Colour' : 'Black & White'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-line">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Paper Size</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedOrder.paperSize}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-line">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sides</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {selectedOrder.sides === 'DOUBLE' ? 'Duplex (2-Sided)' : 'Single-sided'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-line">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Binding</span>
                  <span className="font-bold text-indigo-700 capitalize mt-0.5 block">
                    {selectedOrder.binding || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer & Payment Info */}
            <div className="p-4 rounded-2xl bg-white border border-line space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-dashed border-line">
                <span className="text-slate-500 font-medium">Customer Name:</span>
                <span className="font-bold text-slate-900">{selectedOrder.user?.name || 'Customer'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-dashed border-line">
                <span className="text-slate-500 font-medium">Customer Email:</span>
                <span className="font-mono text-slate-700">{selectedOrder.user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-dashed border-line">
                <span className="text-slate-500 font-medium">Page Range:</span>
                <span className="font-semibold text-slate-900">{selectedOrder.pageRange || 'All pages'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-dashed border-line">
                <span className="text-slate-500 font-medium">Total Copies &amp; Sheets:</span>
                <span className="font-bold text-indigo-950">
                  {selectedOrder.copies} sets ({selectedOrder.totalPages * selectedOrder.copies} total printed sheets)
                </span>
              </div>
              {selectedOrder.instructions && (
                <div className="pt-2">
                  <span className="text-slate-500 font-medium block mb-1">Special Desk Instructions:</span>
                  <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 italic text-xs">
                    "{selectedOrder.instructions}"
                  </p>
                </div>
              )}
            </div>

            {/* Quick Document Links */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <a
                href={printReadyUrl(selectedOrder.id)}
                target="_blank"
                rel="noreferrer"
                className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-4 flex-1 inline-flex items-center justify-center gap-2 rounded-xl shadow-xs"
              >
                <Printer size={16} /> Open Print-Ready PDF (With Cover)
              </a>
              <a
                href={coverPageUrl(selectedOrder.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary font-semibold text-xs h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl"
              >
                <FileText size={16} /> Cover Sheet Only
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* QR Scanner Modal */}
      <ScanQrModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onSuccess={() => loadOrders(page, true)}
      />
    </div>
  );
}
