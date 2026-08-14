import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Users,
  Clock,
  CheckCircle2,
  TrendingUp,
  Layers,
  FileText,
  Search,
  RefreshCw,
  Eye,
  Shield,
  Activity,
  ArrowRight,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { formatDate, formatDateTime, formatFileSize } from '../../lib/format.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import Button from '../../components/Button.jsx';

export default function AdminPrinters() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadStationStatus = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.get('/orders/admin/stations');
      setData(res);
    } catch (err) {
      toast('Failed to load printer station analytics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStationStatus();
    // Auto-poll station throughput every 20 seconds
    const interval = setInterval(() => loadStationStatus(true), 20000);
    return () => clearInterval(interval);
  }, [loadStationStatus]);

  if (loading && !data) {
    return <PageLoader label="Loading printer stations and operator status…" />;
  }

  const operators = data?.operators || [];
  const filteredOperators = operators.filter((op) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      op.operator.name.toLowerCase().includes(q) ||
      op.operator.email.toLowerCase().includes(q) ||
      op.operator.role.toLowerCase().includes(q)
    );
  });

  const unprinted = data?.unprintedCount || 0;
  const processing = data?.processingCount || 0;
  const sheetsToday = data?.totalSheetsToday || 0;
  const sheetsAllTime = data?.totalSheetsAllTime || 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">
              Printer Stations &amp; Operators
            </h1>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" title="Live Station Monitoring" />
          </div>
          <p className="text-ink-muted text-xs sm:text-sm mt-0.5">
            Operator output attribution, physical print station throughput &amp; queue fulfillment audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadStationStatus(true)}
            disabled={refreshing}
            className="btn btn-secondary text-xs h-10 px-3.5 inline-flex items-center gap-1.5"
            title="Refresh printer stations status"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Stations'}</span>
          </button>

          <Link
            to="/admin/orders"
            className="btn btn-primary text-xs h-10 px-4 inline-flex items-center gap-2 font-bold shadow-sm"
          >
            <Printer size={16} />
            <span>All Store Orders</span>
          </Link>
        </div>
      </div>

      {/* Top Station Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* 1. Active Print Operators */}
        <div className="card p-5 border border-line rounded-2xl bg-white space-y-3 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Printer Operators</span>
            <span className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Users size={18} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-extrabold text-ink tabular-nums">{operators.length}</span>
              <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                Staff On Duty
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1">Authorized printer admins &amp; dispatchers</p>
          </div>
        </div>

        {/* 2. Total Sheets Printed Today */}
        <div className="card p-5 border border-line rounded-2xl bg-white space-y-3 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Sheets Printed Today</span>
            <span className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Printer size={18} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-extrabold text-ink tabular-nums">{sheetsToday}</span>
              <span className="text-xs text-ink-muted">sheets</span>
            </div>
            <p className="text-xs text-ink-muted mt-1">Completed print runs today</p>
          </div>
        </div>

        {/* 3. Queue Backlog */}
        <div className="card p-5 border border-line rounded-2xl bg-white space-y-3 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Queue Backlog</span>
            <span className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={18} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-extrabold text-ink tabular-nums">{unprinted}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {unprinted === 0 ? 'Clear' : 'Pending'}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1">{processing} jobs currently in print spooler</p>
          </div>
        </div>

        {/* 4. Lifetime Output */}
        <div className="card p-5 border border-line rounded-2xl bg-white space-y-3 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Lifetime Print Volume</span>
            <span className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp size={18} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-extrabold text-ink tabular-nums">{sheetsAllTime}</span>
              <span className="text-xs text-ink-muted">sheets</span>
            </div>
            <p className="text-xs text-ink-muted mt-1">Across all completed store orders</p>
          </div>
        </div>
      </div>

      {/* Operators Performance Table */}
      <div className="card bg-white overflow-hidden border border-line shadow-xs space-y-4 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h3 className="font-display font-bold text-ink text-base">Operator Attribution &amp; Output</h3>
            <p className="text-xs text-ink-muted">Individual sheets printed and job fulfillment breakdown per operator</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search operators…"
              className="field-input pl-8 h-9 text-xs w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-sunken text-ink-muted uppercase tracking-wider font-semibold border-b border-line text-[11px]">
              <tr>
                <th className="px-6 py-3">Operator Name</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Printed Today</th>
                <th className="px-6 py-3">All-Time Output</th>
                <th className="px-6 py-3">Colour vs B&amp;W</th>
                <th className="px-6 py-3 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredOperators.map((item) => {
                const { operator, sheetsPrintedToday, ordersCompletedToday, sheetsPrintedAllTime, ordersCompletedAllTime, colorSheets, bwSheets, lastPrintedAt } = item;

                return (
                  <tr key={operator.id} className="hover:bg-paper-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                          {operator.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-ink text-sm">{operator.name}</p>
                          <p className="text-[11px] text-ink-muted font-mono">{operator.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${operator.role === 'PRINTER_ADMIN' ? 'badge-accent' : 'badge-neutral'} font-semibold text-[10px]`}>
                        {operator.role === 'PRINTER_ADMIN' ? 'Printer Admin' : 'Admin'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${operator.isActive ? 'text-emerald-700' : 'text-rose-600'}`}>
                        <span className={`h-2 w-2 rounded-full ${operator.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {operator.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-ink text-sm tabular-nums">
                        {sheetsPrintedToday} <span className="text-xs font-normal text-ink-muted">sheets</span>
                      </p>
                      <span className="text-[11px] text-ink-muted">({ordersCompletedToday} orders)</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-teal-700 text-sm tabular-nums">
                        {sheetsPrintedAllTime} <span className="text-xs font-normal text-ink-muted">sheets</span>
                      </p>
                      <span className="text-[11px] text-ink-muted">({ordersCompletedAllTime} orders total)</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-0.5 text-[11px]">
                        <div className="text-amber-900 font-medium">{colorSheets} Colour</div>
                        <div className="text-slate-600">{bwSheets} Black &amp; White</div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap text-ink-muted text-xs">
                      {lastPrintedAt ? formatDateTime(lastPrintedAt) : 'No print logs'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Operator Print Log Audit Stream */}
      <div className="card bg-white overflow-hidden border border-line shadow-xs">
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper-sunken">
          <div>
            <h3 className="font-display font-bold text-ink text-base">Live Print Fulfillment Audit Stream</h3>
            <p className="text-xs text-ink-muted">Real-time log of documents dispatched and operator who performed the print</p>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            Latest 15 Print Jobs
          </span>
        </div>

        {data?.recentPrintedLogs?.length === 0 ? (
          <div className="py-12 text-center text-ink-muted text-xs">
            No printed document logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-sunken text-ink-muted uppercase tracking-wider font-semibold border-b border-line text-[11px]">
                <tr>
                  <th className="px-5 py-3">Order #</th>
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Dispatched By Operator</th>
                  <th className="px-5 py-3">Sheets</th>
                  <th className="px-5 py-3 text-right">Printed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data?.recentPrintedLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-paper-hover transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-ink">{log.orderNumber}</td>
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <FileTypeIcon mimeType={log.mimeType} size={15} />
                        <span className="truncate text-ink font-medium">{log.documentName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">{log.customerName}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md text-[11px]">
                        {log.operatorName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-ink">{log.sheets}</span>
                      <span className="text-[10px] text-ink-muted ml-1">({log.colorMode})</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-ink-muted">{formatDateTime(log.printedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
