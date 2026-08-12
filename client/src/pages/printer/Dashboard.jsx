import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  QrCode,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Eye,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { api, printReadyUrl } from '../../lib/api.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader } from '../../components/States.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';
import ScanQrModal from '../../components/ScanQrModal.jsx';
import { usePrinterAccessibility } from '../../context/PrinterAccessibilityContext.jsx';

export default function PrinterDashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const {
    settings: a11y,
    spacingGapClass,
    cardPaddingClass,
    contrastClass,
    numeralWeightClass,
    t,
  } = usePrinterAccessibility();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const loadStats = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await api.get('/orders/printer-stats');
      setStats(data);
    } catch (err) {
      toast('Failed to load printer statistics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Auto refresh every 20 seconds for live print queue updates
    const interval = setInterval(() => loadStats(true), 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !stats) {
    return <PageLoader label="Loading print station metrics…" />;
  }

  const unprinted = stats?.unprintedCount || 0;
  const pagesToday = stats?.totalPagesPrintedToday || 0;
  const pagesAllTime = stats?.totalPagesPrintedAllTime || 0;
  const colorAllTime = stats?.colorPagesAllTime || 0;
  const bwAllTime = stats?.bwPagesAllTime || 0;
  const totalColorBw = colorAllTime + bwAllTime || 1;
  const colorPercent = Math.round((colorAllTime / totalColorBw) * 100);
  const bwPercent = 100 - colorPercent;

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-fade-in transition-all duration-150 w-full">
      {/* Station Header - Compact, High Impact, Edge-to-Edge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-3.5 sm:p-4.5 rounded-2xl shadow-sm relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-0.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-400/30 text-[11px] font-semibold tracking-wide">
            <Printer size={12} className="animate-pulse" /> {t('stationTitle')}
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-white">
            {t('welcome')}, {user?.name || t('operator')}
          </h1>
          <p className="text-teal-200/80 text-xs max-w-xl">
            {t('subtitle')}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadStats(true)}
            disabled={refreshing}
            className="btn bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs h-8 px-2.5 inline-flex items-center gap-1 rounded-xl backdrop-blur-xs transition-all cursor-pointer"
            title="Refresh queue"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? t('syncing') : t('sync')}</span>
          </button>

          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="btn bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs h-8 px-3 inline-flex items-center gap-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <QrCode size={14} />
            <span>{t('scanQr')}</span>
          </button>

          <Link
            to="/printer/orders"
            className="btn bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs h-8 px-3 inline-flex items-center gap-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Layers size={14} className="text-teal-700" />
            <span>{t('printQueue')} ({unprinted})</span>
          </Link>
        </div>
      </div>

      {/* Top Operational KPI Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${spacingGapClass}`}>
        {/* 1. Print Queue */}
        <div
          className={`card ${cardPaddingClass} ${contrastClass} border-l-4 border-l-amber-500 bg-white space-y-2 relative overflow-hidden group hover:shadow-card transition-all`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{t('printQueue')}</span>
            <span className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-display text-ink tabular-nums ${numeralWeightClass}`}>{unprinted}</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {unprinted === 0 ? t('queueClear') : t('pending')}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">{t('waitingQueue')}</p>
          </div>
          <Link
            to="/printer/orders"
            className="text-xs font-bold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 pt-0.5"
          >
            {t('processJobs')} &rarr;
          </Link>
        </div>

        {/* 2. Pages Printed Today */}
        <div
          className={`card ${cardPaddingClass} ${contrastClass} border-l-4 border-l-teal-600 bg-white space-y-2 relative overflow-hidden group hover:shadow-card transition-all`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{t('outputToday')}</span>
            <span className="h-8 w-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Printer size={16} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-display text-teal-800 tabular-nums ${numeralWeightClass}`}>
                {stats?.personalStats?.sheetsPrintedToday ?? 0}
              </span>
              <span className="text-xs text-ink-muted">{t('sheetsByYou')}</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {t('acrossJobsFulfilled', { count: stats?.personalStats?.ordersPrintedToday ?? 0 })}
            </p>
          </div>
          <div className="text-[11px] text-teal-700 font-semibold pt-0.5">
            {t('stationTotalToday', { pages: pagesToday, orders: stats?.printedTodayCount || 0 })}
          </div>
        </div>

        {/* 3. Total Lifetime Printed Volume */}
        <div
          className={`card ${cardPaddingClass} ${contrastClass} border-l-4 border-l-indigo-600 bg-white space-y-2 relative overflow-hidden group hover:shadow-card transition-all`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{t('lifetimeVolume')}</span>
            <span className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <TrendingUp size={16} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-display text-indigo-800 tabular-nums ${numeralWeightClass}`}>
                {stats?.personalStats?.sheetsPrintedAllTime ?? 0}
              </span>
              <span className="text-xs text-ink-muted">{t('sheetsByYou')}</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {t('acrossJobsAllTime', { count: stats?.personalStats?.ordersPrintedAllTime ?? 0 })}
            </p>
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold pt-0.5">
            {t('stationAllTime', { pages: pagesAllTime })}
          </div>
        </div>

        {/* 4. Bound & Finished Jobs */}
        <div
          className={`card ${cardPaddingClass} ${contrastClass} border-l-4 border-l-emerald-600 bg-white space-y-2 relative overflow-hidden group hover:shadow-card transition-all`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{t('boundFinished')}</span>
            <span className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpen size={16} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl sm:text-3xl font-display text-ink tabular-nums ${numeralWeightClass}`}>
                {stats?.boundJobs || 0}
              </span>
              <span className="text-xs text-ink-muted">{t('specialBound')}</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">{t('spiralSoftHard')}</p>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold pt-0.5">
            {t('inFinishingQueue', { count: stats?.processingCount || 0 })}
          </div>
        </div>
      </div>

      {/* Mode Distribution & Specification Breakdown */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 ${spacingGapClass}`}>
        {/* Color vs B&W Print Distribution */}
        <div className={`card ${cardPaddingClass} ${contrastClass} space-y-3.5 bg-white`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-ink text-base">{t('modeBreakdown')}</h3>
              <p className="text-xs text-ink-muted">{t('colorVsBw')}</p>
            </div>
            <span className="h-7 w-7 rounded-lg bg-paper-sunken text-ink-muted flex items-center justify-center">
              <Sparkles size={15} />
            </span>
          </div>

          <div className="space-y-3">
            {/* Visual ratio bar */}
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex border border-line">
              <div
                style={{ width: `${colorPercent}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                title={`Colour: ${colorPercent}%`}
              />
              <div
                style={{ width: `${bwPercent}%` }}
                className="h-full bg-slate-800 transition-all duration-500"
                title={`B&W: ${bwPercent}%`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-950">{t('colorMode')}</span>
                </div>
                <p className={`text-base font-bold text-ink font-display mt-0.5 tabular-nums ${numeralWeightClass}`}>
                  {colorAllTime} <span className="text-xs font-normal text-ink-muted">{t('pages')}</span>
                </p>
                <p className="text-[10px] text-amber-800 font-semibold mt-0.5">{t('ofTotalVolume', { percent: colorPercent })}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-800" />
                  <span className="text-xs font-bold text-slate-900">{t('bwMode')}</span>
                </div>
                <p className={`text-base font-bold text-ink font-display mt-0.5 tabular-nums ${numeralWeightClass}`}>
                  {bwAllTime} <span className="text-xs font-normal text-ink-muted">{t('pages')}</span>
                </p>
                <p className="text-[10px] text-slate-600 font-semibold mt-0.5">{t('ofTotalVolume', { percent: bwPercent })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Paper & Finishing Specs */}
        <div className={`card ${cardPaddingClass} ${contrastClass} space-y-3 bg-white`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-ink text-base">{t('paperMediaSpecs')}</h3>
              <p className="text-xs text-ink-muted">{t('mostRequested')}</p>
            </div>
            <span className="h-7 w-7 rounded-lg bg-paper-sunken text-ink-muted flex items-center justify-center">
              <Layers size={15} />
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-paper-sunken border border-line">
              <span className="font-medium text-ink">{t('a4Sheet')}</span>
              <span className={`font-bold text-ink tabular-nums ${numeralWeightClass}`}>{stats?.a4Jobs || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-paper-sunken border border-line">
              <span className="font-medium text-ink">{t('a3Sheet')}</span>
              <span className={`font-bold text-ink tabular-nums ${numeralWeightClass}`}>{stats?.a3Jobs || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-paper-sunken border border-line">
              <span className="font-medium text-ink">{t('customBinding')}</span>
              <span className={`font-bold text-teal-700 tabular-nums ${numeralWeightClass}`}>{stats?.boundJobs || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick Operations Guide */}
        <div className={`card ${cardPaddingClass} ${contrastClass} space-y-2.5 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200`}>
          <div className="flex items-center gap-1.5 text-teal-900">
            <Printer size={16} className="text-teal-700" />
            <h3 className="font-display font-bold text-base">{t('operatorGuide')}</h3>
          </div>

          <ol className="space-y-1 text-xs text-teal-950/90 list-decimal list-inside leading-relaxed">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
          </ol>

          <div className="pt-0.5">
            <Link to="/printer/orders" className="btn btn-primary text-xs w-full py-1.5 font-bold shadow-xs">
              {t('goToQueue')} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Completed Print Jobs Feed */}
      <div className={`card ${contrastClass} bg-white overflow-hidden border border-line shadow-xs`}>
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-paper-sunken">
          <div>
            <h3 className="font-display font-bold text-ink text-base">{t('recentlyCompleted')}</h3>
            <p className="text-xs text-ink-muted">{t('lastPrintedAudit')}</p>
          </div>
          <Link to="/printer/orders?tab=completed" className="text-xs font-bold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
            {t('viewAllCompleted')} &rarr;
          </Link>
        </div>

        {stats?.recentPrintedList?.length === 0 ? (
          <div className="py-10 text-center text-ink-muted text-xs">
            {t('noCompletedToday')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-sunken text-ink-muted uppercase tracking-wider font-semibold border-b border-line text-[11px]">
                <tr>
                  <th className="px-4 py-2">{t('orderNumber')}</th>
                  <th className="px-4 py-2">{t('document')}</th>
                  <th className="px-4 py-2">{t('customer')}</th>
                  <th className="px-4 py-2">{t('printedSheets')}</th>
                  <th className="px-4 py-2">{t('completedAt')}</th>
                  <th className="px-4 py-2 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats?.recentPrintedList?.map((o) => (
                  <tr key={o.id} className="hover:bg-paper-hover transition-colors">
                    <td className="px-4 py-2 font-mono font-bold text-ink">{o.orderNumber}</td>
                    <td className="px-4 py-2 max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <FileTypeIcon mimeType={o.document?.mimeType} size={14} />
                        <span className="truncate text-ink font-medium">{o.document?.originalName || 'Document'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-ink-soft">{o.user?.name || 'Customer'}</td>
                    <td className="px-4 py-2">
                      <span className={`font-bold text-ink ${numeralWeightClass}`}>{(o.totalPages || 1) * (o.copies || 1)}</span>
                      <span className="text-ink-muted text-[10px] ml-1">({o.copies}× {o.totalPages}p)</span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{formatDateTime(o.updatedAt)}</td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={printReadyUrl(o.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn bg-paper-sunken hover:bg-paper-hover text-teal-700 font-semibold text-[11px] h-6 px-2 inline-flex items-center gap-1 border border-line rounded-md"
                      >
                        <Printer size={11} /> {t('reprint')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ScanQrModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onSuccess={() => loadStats(true)}
      />
    </div>
  );
}
