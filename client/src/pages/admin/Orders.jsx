import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, previewUrl, invoiceUrl, coverPageUrl, printReadyUrl } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import { EmptyState } from '../../components/States';
import Modal from '../../components/Modal';
import ScanQrModal from '../../components/ScanQrModal';
import FileTypeIcon from '../../components/FileTypeIcon';
import Button from '../../components/Button';
import DocPreview from '../../components/user/DocPreview';
import { formatMoney, formatDateTime, formatDate, formatFileSize, fileTypeLabel } from '../../lib/format';
import {
  Package,
  Search,
  ExternalLink,
  Download,
  Eye,
  User,
  Phone,
  Mail,
  FileText,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  BookOpen,
  QrCode,
  ArrowUpDown,
  Filter,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';

const STATUS_COLORS = {
  RECEIVED: 'bg-blue-100 text-blue-700 border-blue-200',
  PROCESSING: 'bg-orange-100 text-orange-700 border-orange-200',
  PRINTED: 'bg-purple-100 text-purple-700 border-purple-200',
  DELIVERED: 'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [timeRange, setTimeRange] = useState('');
  const [colorMode, setColorMode] = useState('');
  const [orientation, setOrientation] = useState('');
  const [search, setSearch] = useState('');

  // Selected Order Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const toast = useToast();
  const { user } = useAuth();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: 15,
        status: statusFilter,
        sortBy,
        timeRange,
        colorMode,
        orientation,
        search: search.trim(),
      });
      const data = await api.get(`/orders/admin/all?${query}`);
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      toast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, sortBy, timeRange, colorMode, orientation]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const resetFilters = () => {
    setStatusFilter('');
    setSortBy('created_desc');
    setTimeRange('');
    setColorMode('');
    setOrientation('');
    setSearch('');
    setPage(1);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      setStatusUpdating(true);
      await api.put(`/orders/admin/${id}/status`, { orderStatus: newStatus });
      toast(`Order status updated to ${newStatus}`, 'success');
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, orderStatus: newStatus } : o)));
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder((prev) => ({ ...prev, orderStatus: newStatus }));
      }
    } catch (err) {
      toast(err.message || 'Failed to update status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const hasActiveFilters = Boolean(statusFilter || timeRange || colorMode || orientation || search || sortBy !== 'created_desc');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Manage Orders</h1>
          <p className="text-ink-muted mt-1">Live queue, intelligent sorting, time filters &amp; 1-click print bundling.</p>
        </div>
        <button
          type="button"
          onClick={() => setScanModalOpen(true)}
          className="btn btn-primary text-xs flex items-center gap-2 py-2.5 px-4 shadow-sm self-start sm:self-auto shrink-0"
        >
          <QrCode size={16} /> Scan Order QR
        </button>
      </header>

      {/* Advanced Filter & Sorting Toolbar */}
      <div className="card p-4 sm:p-5 space-y-3.5">
        {/* Search row */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={17} />
            <input
              type="text"
              placeholder="Search by Order #, customer name, email, or document..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-line rounded-xl focus:ring-2 focus:ring-accent-soft outline-none text-xs sm:text-sm bg-white"
            />
          </div>
          <button type="submit" className="btn btn-primary text-xs whitespace-nowrap px-4 py-2">
            <Search size={14} /> Search
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-secondary text-xs whitespace-nowrap px-3 py-2 text-ink-muted hover:text-ink flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Reset
            </button>
          )}
        </form>

        {/* Dropdown Filters & Sorters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* 1. Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
              Order Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="">All Statuses</option>
              <option value="RECEIVED">Received</option>
              <option value="PROCESSING">Processing</option>
              <option value="PRINTED">Printed</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* 2. Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowUpDown size={11} /> Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="created_desc">Newest Received First</option>
              <option value="created_asc">Oldest First</option>
              <option value="updated_desc">Recently Printed / Updated</option>
              <option value="amount_desc">Highest Price First</option>
              <option value="amount_asc">Lowest Price First</option>
              <option value="pages_desc">Most Pages First</option>
              <option value="pages_asc">Least Pages First</option>
              <option value="status_asc">Status Grouping</option>
            </select>
          </div>

          {/* 3. Time Filter */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock size={11} /> Time Window
            </label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="">All Time</option>
              <option value="1h">Last 1 Hour</option>
              <option value="today">Today (Since 00:00)</option>
              <option value="24h">Last 24 Hours</option>
              <option value="week">This Week (Last 7 Days)</option>
              <option value="month">This Month (30 Days)</option>
            </select>
          </div>

          {/* 4. Quick Specs: Color / Orientation */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
              Color Mode
            </label>
            <select
              value={colorMode}
              onChange={(e) => {
                setColorMode(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="">All Color Modes</option>
              <option value="COLOR">Full Colour</option>
              <option value="BW">Black &amp; White</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders match criteria"
            description="Try adjusting your filters, sort order, or search keywords."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover/70 border-b border-line text-ink-muted uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Order &amp; Timestamp</th>
                  <th className="px-6 py-3.5 font-semibold">Customer</th>
                  <th className="px-6 py-3.5 font-semibold">Document &amp; Configuration</th>
                  <th className="px-6 py-3.5 font-semibold">Pages &amp; Copies</th>
                  <th className="px-6 py-3.5 font-semibold">Total Amount</th>
                  <th className="px-6 py-3.5 font-semibold">Fulfillment Status</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-paper-hover/60 transition-colors cursor-pointer group"
                  >
                    {/* Order Number & Timestamp */}
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-bold text-accent group-hover:underline flex items-center gap-1.5">
                        {order.orderNumber}
                      </div>
                      <div className="text-[11px] text-ink-muted mt-0.5 flex items-center gap-1">
                        <Clock size={11} className="text-ink-muted/80" />
                        {formatDateTime(order.createdAt)}
                      </div>
                      {order.orderStatus === 'PRINTED' || order.orderStatus === 'DELIVERED' ? (
                        <div className="text-[10px] text-teal-700 font-medium mt-0.5">
                          {order.orderStatus === 'PRINTED' ? 'Printed' : 'Delivered'}: {formatDateTime(order.updatedAt)}
                        </div>
                      ) : null}
                    </td>

                    {/* Customer */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-ink text-xs sm:text-sm">{order.user?.name || 'Guest'}</div>
                      <div className="text-xs text-ink-muted">{order.user?.email}</div>
                    </td>

                    {/* Document & Specs */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5 max-w-[260px]">
                        <FileTypeIcon mimeType={order.document?.mimeType} size={18} boxed />
                        <div className="min-w-0">
                          <p className="text-ink font-medium text-xs truncate" title={order.document?.originalName}>
                            {order.document?.originalName || 'Document'}
                          </p>
                          <p className="text-[11px] text-ink-muted truncate mt-0.5">
                            <span className="font-semibold text-ink-soft">{order.colorMode === 'COLOR' ? 'Colour' : 'B&W'}</span> · {order.paperSize} · {order.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} · {order.sides === 'DOUBLE' ? '2-sided' : '1-sided'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Pages & Copies */}
                    <td className="px-6 py-4">
                      <span className="font-semibold text-ink text-xs">
                        {order.totalPages} pages
                      </span>
                      <div className="text-[11px] text-ink-muted">
                        {order.copies} {order.copies > 1 ? 'copies' : 'copy'}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink font-display text-sm">{formatMoney(order.totalAmount)}</div>
                      {order.discountAmount > 0 ? (
                        <div className="text-[10px] text-green-700 font-semibold">(-{formatMoney(order.discountAmount)})</div>
                      ) : null}
                    </td>

                    {/* Status Select */}
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.orderStatus}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-3 py-1 border outline-none cursor-pointer appearance-none shadow-xs ${
                          STATUS_COLORS[order.orderStatus] || STATUS_COLORS.RECEIVED
                        }`}
                      >
                        <option value="RECEIVED">Received</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="PRINTED">Printed</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>

                    {/* Quick Print & Details */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={printReadyUrl(order.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
                          title="Print complete document with auto-attached front & back cover pages"
                        >
                          <Printer size={13} /> Print
                        </a>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors inline-flex items-center gap-1 text-xs font-medium"
                        >
                          <Eye size={15} /> Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit || 15}
          onPageChange={setPage}
        />
      )}

      {/* Order Details & Live Document Preview Modal */}
      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order Details · ${selectedOrder.orderNumber}` : 'Order details'}
        size="lg"
        footer={
          selectedOrder && (
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-muted">Quick status:</span>
                <select
                  value={selectedOrder.orderStatus}
                  disabled={statusUpdating}
                  onChange={(e) => updateStatus(selectedOrder.id, e.target.value)}
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer ${
                    STATUS_COLORS[selectedOrder.orderStatus] || STATUS_COLORS.RECEIVED
                  }`}
                >
                  <option value="RECEIVED">Received</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="PRINTED">Printed</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={printReadyUrl(selectedOrder.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm"
                  title="Open complete print bundle: Front Security Cover + Document + Back Security Cover"
                >
                  <Printer size={15} /> Print Ready PDF (with 1st &amp; Last Page)
                </a>
                <a
                  href={coverPageUrl(selectedOrder.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary text-xs inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                  title="Open standalone branded cover slip with QR code"
                >
                  <QrCode size={15} /> Cover Slip Only
                </a>
                <a
                  href={invoiceUrl(selectedOrder.id)}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
                  download={`Invoice-${selectedOrder.orderNumber}.pdf`}
                >
                  <FileText size={15} /> Invoice (PDF)
                </a>
                <a
                  href={previewUrl(selectedOrder.document?.id, { download: true })}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
                  download
                  title="Download raw original uploaded document"
                >
                  <Download size={15} /> Original File
                </a>
                <Button variant="ghost" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Primary Action Card: Print Ready PDF with 1st & Last Page */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-teal-50 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <Printer size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                    Print Ready PDF (with 1st &amp; Last Page)
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Auto-Attached</span>
                  </h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Unified single document: Front Security Cover + Document Content + Back Feedback Slip
                  </p>
                </div>
              </div>
              <a
                href={printReadyUrl(selectedOrder.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary text-xs font-semibold py-2.5 px-4 shadow-md shadow-accent/20 flex items-center justify-center gap-2 shrink-0"
              >
                <Printer size={16} /> Open Print-Ready PDF
              </a>
            </div>

            {/* Top Overview banner */}
            <div className="p-4 rounded-xl border border-line bg-paper-sunken flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-ink-muted">Placed on</span>
                <p className="text-sm font-semibold text-ink flex items-center gap-1.5 mt-0.5">
                  <Calendar size={15} className="text-ink-muted" />
                  {formatDateTime(selectedOrder.createdAt)}
                </p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Customer</span>
                <p className="text-sm font-semibold text-ink flex items-center gap-1.5 mt-0.5">
                  <User size={15} className="text-ink-muted" />
                  {selectedOrder.user?.name || 'Guest'}
                </p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Contact</span>
                <p className="text-xs font-mono text-ink flex items-center gap-1 mt-0.5">
                  <Mail size={13} className="text-ink-muted" />
                  {selectedOrder.user?.email}
                </p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Total Paid</span>
                <p className="text-base font-bold font-display text-accent mt-0.5">
                  {formatMoney(selectedOrder.totalAmount)}
                </p>
              </div>
            </div>

            {/* Operator Print Attribution */}
            {selectedOrder.printedBy ? (
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-teal-950">
                <div className="flex items-center gap-2.5">
                  <Printer size={16} className="text-teal-700 shrink-0" />
                  <div>
                    <span className="font-bold">Dispatched by Operator:</span>{' '}
                    <span>{selectedOrder.printedBy.name} ({selectedOrder.printedBy.email})</span>
                  </div>
                </div>
                {selectedOrder.printedAt ? (
                  <span className="text-[11px] text-teal-700 font-mono">
                    {formatDateTime(selectedOrder.printedAt)}
                  </span>
                ) : null}
              </div>
            ) : selectedOrder.orderStatus === 'RECEIVED' || selectedOrder.orderStatus === 'PROCESSING' ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <span>Status: Unprinted &mdash; Waiting in active print queue</span>
              </div>
            ) : null}

            {/* Document Preview & Details Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-display text-ink flex items-center justify-between">
                <span>Document &amp; File Preview</span>
                <a
                  href={previewUrl(selectedOrder.document?.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={13} /> Open full preview in new tab
                </a>
              </h3>

              <div className="rounded-xl border border-line overflow-hidden bg-white">
                {/* Document metadata header */}
                <div className="p-3.5 bg-paper-hover/60 border-b border-line flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileTypeIcon mimeType={selectedOrder.document?.mimeType} size={22} boxed />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate" title={selectedOrder.document?.originalName}>
                        {selectedOrder.document?.originalName}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {fileTypeLabel(selectedOrder.document?.mimeType)} · {formatFileSize(selectedOrder.document?.fileSize)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={previewUrl(selectedOrder.document?.id, { download: true })}
                    className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-paper-hover border border-line bg-white transition-colors shrink-0"
                    title="Download file"
                    download
                  >
                    <Download size={16} />
                  </a>
                </div>

                {/* Embedded Document Preview / Viewer */}
                {selectedOrder.document ? (
                  <DocPreview doc={selectedOrder.document} height="320px" />
                ) : null}
              </div>
            </div>

            {/* Print Specifications Grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-display text-ink flex items-center gap-2">
                <Printer size={16} className="text-accent" /> Print Job Specifications
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-xl border border-line bg-paper-sunken/40">
                  <span className="text-xs text-ink-muted block">Color Mode</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {selectedOrder.colorMode === 'COLOR' ? 'Full Color' : 'Black & White'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-line bg-paper-sunken/40">
                  <span className="text-xs text-ink-muted block">Paper Size</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {selectedOrder.paperSize}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-line bg-paper-sunken/40">
                  <span className="text-xs text-ink-muted block">Print Sides</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {selectedOrder.sides === 'DOUBLE' ? 'Double-sided (Duplex)' : 'Single-sided'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-line bg-paper-sunken/40">
                  <span className="text-xs text-ink-muted block">Orientation</span>
                  <span className="font-semibold text-ink mt-0.5 block capitalize">
                    {selectedOrder.orientation ? selectedOrder.orientation.toLowerCase() : 'Portrait'}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-line bg-paper-sunken/40">
                  <span className="text-xs text-ink-muted block">Copies &amp; Pages</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {selectedOrder.copies} {selectedOrder.copies === 1 ? 'copy' : 'copies'} · {selectedOrder.totalPages} pages
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-line bg-paper-sunken/40">
                  <span className="text-xs text-ink-muted block">Binding</span>
                  <span className="font-semibold text-ink mt-0.5 block capitalize">
                    {selectedOrder.binding === 'none' ? 'None' : selectedOrder.binding}
                  </span>
                </div>
              </div>
            </div>

            {/* Special Instructions (if any) */}
            {selectedOrder.instructions && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs">
                <span className="font-bold text-amber-900 block mb-1">Customer Special Instructions:</span>
                <p className="text-amber-800 whitespace-pre-wrap">{selectedOrder.instructions}</p>
              </div>
            )}

            {/* Cost & Payment Breakdown */}
            <div className="p-4 rounded-xl border border-line bg-paper-sunken text-sm space-y-2">
              <div className="flex justify-between text-ink-muted">
                <span>Print Subtotal</span>
                <span>{formatMoney(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div className="flex justify-between text-green-700 font-medium">
                  <span>Coupon Discount</span>
                  <span>- {formatMoney(selectedOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-muted">
                <span>GST / Tax</span>
                <span>{formatMoney(selectedOrder.tax)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-line font-bold text-ink">
                <span>Total Amount</span>
                <span className="text-lg font-display text-accent">{formatMoney(selectedOrder.totalAmount)}</span>
              </div>
              <div className="pt-1 text-xs text-ink-muted flex items-center justify-between">
                <span>Payment Method: {selectedOrder.paymentMethod}</span>
                <span className={`font-semibold flex items-center gap-1 ${
                  selectedOrder.paymentStatus === 'PAID'
                    ? 'text-green-700'
                    : selectedOrder.paymentStatus === 'FAILED'
                    ? 'text-rose-700'
                    : 'text-amber-700'
                }`}>
                  <CheckCircle2 size={13} /> {selectedOrder.paymentStatus}
                </span>
              </div>
              {selectedOrder.upiRefNumber && (
                <div className="pt-1 text-xs text-ink-muted flex items-center justify-between border-t border-line">
                  <span>Submitted UTR / Ref:</span>
                  <span className="font-mono font-bold text-ink">{selectedOrder.upiRefNumber}</span>
                </div>
              )}
              {selectedOrder.paymentStatus !== 'PAID' && (
                <div className="pt-2">
                  <Link
                    to={user?.role === 'PRINTER_ADMIN' ? '/printer/payments' : '/admin/payments'}
                    className="btn btn-primary text-xs w-full py-1.5 inline-flex items-center justify-center gap-1.5"
                  >
                    Review in Payments Verification Hub &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* QR Code Scanner & Verification Modal */}
      <ScanQrModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onDelivered={() => {
          fetchOrders();
          toast('Order delivered successfully', 'success');
        }}
      />
    </div>
  );
}
