import { useState, useEffect, useRef, useCallback } from 'react';
import { api, getToken } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useToast } from '../../components/Toaster';
import Modal from '../../components/Modal';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Activity,
  Radio,
  Pause,
  Play,
  Download,
  Search,
  RefreshCw,
  Filter,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Bot,
  AlertTriangle,
  Flame,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Eye,
  Server,
  Fingerprint,
  FileCode,
  MapPin,
  Clock,
  Zap,
} from 'lucide-react';

const SEVERITY_COLORS = {
  CRITICAL: 'bg-rose-500 text-white border-rose-600',
  ALERT: 'bg-amber-500 text-white border-amber-600',
  WARN: 'bg-amber-100 text-amber-900 border-amber-300',
  INFO: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const STATUS_COLOR = (code) => {
  if (code >= 200 && code < 300) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (code >= 300 && code < 400) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (code >= 400 && code < 500) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const DEVICE_ICON = (deviceType, isBot) => {
  if (isBot || deviceType === 'bot') return <Bot size={15} className="text-purple-600 shrink-0" />;
  if (deviceType === 'mobile') return <Smartphone size={15} className="text-blue-600 shrink-0" />;
  if (deviceType === 'tablet') return <Tablet size={15} className="text-amber-600 shrink-0" />;
  return <Monitor size={15} className="text-slate-600 shrink-0" />;
};

export default function AdminAuditLog() {
  const toast = useToast();

  // Overview Stats
  const [stats, setStats] = useState({
    totalToday: 0,
    total24h: 0,
    threatsCount: 0,
    botPercentage: 0,
    errorRate: 0,
    severityBreakdown: { INFO: 0, WARN: 0, ALERT: 0, CRITICAL: 0 },
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Audit Logs State for Scroll-Based Rendering
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusCategory, setStatusCategory] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Live SSE Stream state
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [newLiveCount, setNewLiveCount] = useState(0);
  const [liveStreamConnected, setLiveStreamConnected] = useState(false);

  // Selected Log for Forensic Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Sentinel for Infinite Scroll
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/audit/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Initial Logs Batch
  const fetchLogs = useCallback(
    async (reset = true) => {
      try {
        if (reset) {
          setLoading(true);
          setNextCursor(null);
        } else {
          setLoadingMore(true);
        }

        const params = new URLSearchParams({
          limit: '35',
          ...(severityFilter ? { severity: severityFilter } : {}),
          ...(statusCategory ? { statusCategory } : {}),
          ...(deviceFilter ? { deviceType: deviceFilter } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(!reset && nextCursor ? { cursor: String(nextCursor) } : {}),
        });

        const res = await api.get(`/audit?${params.toString()}`);

        if (reset) {
          setLogs(res.logs || []);
        } else {
          setLogs((prev) => {
            // Deduplicate incoming logs
            const existingIds = new Set(prev.map((l) => l.id));
            const newUnique = (res.logs || []).filter((l) => !existingIds.has(l.id));
            return [...prev, ...newUnique];
          });
        }

        setHasMore(res.hasMore || false);
        setNextCursor(res.nextCursor || null);
        setTotalCount(res.totalCount || 0);
      } catch (err) {
        toast(err.message || 'Failed to load audit logs', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [severityFilter, statusCategory, deviceFilter, debouncedSearch, nextCursor, toast]
  );

  // Initial load and filter change
  useEffect(() => {
    fetchStats();
    fetchLogs(true);
  }, [severityFilter, statusCategory, deviceFilter, debouncedSearch]);

  // Scroll-based rendering with IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchLogs(false);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading, loadingMore, fetchLogs]);

  // Server-Sent Events (SSE) Live Stream Hook
  useEffect(() => {
    if (!isLiveStreaming) {
      setLiveStreamConnected(false);
      return;
    }

    const token = getToken();
    if (!token) return;

    // Connect to live SSE endpoint
    const streamUrl = `/api/audit/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      setLiveStreamConnected(true);
    };

    eventSource.addEventListener('audit_log', (e) => {
      try {
        const newLog = JSON.parse(e.data);
        setLogs((prev) => {
          // Prepend new log if not already in list
          if (prev.some((item) => item.id === newLog.id)) return prev;
          return [newLog, ...prev];
        });
        setTotalCount((c) => c + 1);

        // Update stats live
        if (newLog.severity === 'CRITICAL' || newLog.severity === 'ALERT') {
          setStats((prev) => ({
            ...prev,
            threatsCount: prev.threatsCount + 1,
            severityBreakdown: {
              ...prev.severityBreakdown,
              [newLog.severity]: (prev.severityBreakdown[newLog.severity] || 0) + 1,
            },
          }));
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    eventSource.onerror = () => {
      setLiveStreamConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [isLiveStreaming]);

  // Copy helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Export CSV
  const handleExportCsv = () => {
    const params = new URLSearchParams({
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(statusCategory ? { statusCode: statusCategory } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    window.open(`/api/audit/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
              <ShieldAlert size={20} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Cyber Forensic Audit Ledger</h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper-sunken border border-line text-[11px] font-semibold text-ink-muted">
              <span className={`h-2 w-2 rounded-full ${liveStreamConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{liveStreamConnected ? 'Live Feed Connected' : 'Feed Offline'}</span>
            </div>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Zero-latency tamper-evident audit logs capturing every API call, geo-location, user-agent signature, and cyber threat vector in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Live Stream Toggle */}
          <button
            type="button"
            onClick={() => setIsLiveStreaming((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all shadow-2xs ${
              isLiveStreaming
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-paper-hover text-ink-muted border-line hover:text-ink'
            }`}
          >
            {isLiveStreaming ? (
              <>
                <Radio size={14} className="animate-pulse text-emerald-600" />
                <span>Live Stream: ON</span>
              </>
            ) : (
              <>
                <Pause size={14} />
                <span>Live Stream: PAUSED</span>
              </>
            )}
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-ink bg-white hover:bg-paper-hover border border-line rounded-xl shadow-2xs transition-colors"
            title="Export forensic audit ledger to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchLogs(true);
            }}
            className="p-2 text-ink-soft bg-white hover:bg-paper-hover border border-line rounded-xl shadow-2xs transition-colors"
            title="Refresh Audit Records"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-accent' : ''} />
          </button>
        </div>
      </div>

      {/* 5 Real-time Forensic Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Requests (Today)</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap size={15} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-ink">
              {statsLoading ? '...' : stats.totalToday.toLocaleString()}
            </div>
            <p className="text-[11px] text-ink-muted mt-0.5">24h Total: {stats.total24h.toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Security Threats</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-rose-700">
              {statsLoading ? '...' : stats.threatsCount}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold mt-0.5">
              <span className="text-rose-600">{stats.severityBreakdown?.CRITICAL || 0} Critical</span>
              <span>·</span>
              <span className="text-amber-600">{stats.severityBreakdown?.ALERT || 0} Alerts</span>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Bot Traffic</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bot size={15} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-purple-700">
              {statsLoading ? '...' : `${stats.botPercentage}%`}
            </div>
            <p className="text-[11px] text-purple-600 mt-0.5 font-medium">Scrapers &amp; automation</p>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Error Rate (4xx/5xx)</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity size={15} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-amber-700">
              {statsLoading ? '...' : `${stats.errorRate}%`}
            </div>
            <p className="text-[11px] text-amber-600 mt-0.5 font-medium">Failures &amp; auth rejections</p>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Audited Records</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={15} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-emerald-700">
              {totalCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Total indexed events</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 space-y-3 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Severity Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-ink-muted mr-1 flex items-center gap-1">
              <Filter size={13} /> Severity:
            </span>
            <button
              type="button"
              onClick={() => setSeverityFilter('')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                severityFilter === '' ? 'bg-ink text-white shadow-2xs' : 'bg-paper-hover text-ink-soft hover:text-ink'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('CRITICAL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                severityFilter === 'CRITICAL' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Critical
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('ALERT')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                severityFilter === 'ALERT' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Alerts
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('WARN')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                severityFilter === 'WARN' ? 'bg-amber-500 text-white shadow-2xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Warnings
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('INFO')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                severityFilter === 'INFO' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              Normal (Info)
            </button>
          </div>

          {/* Quick Category / Status Code Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusCategory}
              onChange={(e) => setStatusCategory(e.target.value)}
              className="h-8 px-2.5 text-xs bg-paper-sunken rounded-lg border border-line font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">All HTTP Statuses</option>
              <option value="2xx">2xx Successful</option>
              <option value="4xx">4xx Client Errors</option>
              <option value="5xx">5xx Server Errors</option>
            </select>

            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="h-8 px-2.5 text-xs bg-paper-sunken rounded-lg border border-line font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">All Devices</option>
              <option value="desktop">Desktop / Laptops</option>
              <option value="mobile">Smartphones (Mobile)</option>
              <option value="tablet">Tablets</option>
              <option value="bot">Bots &amp; Crawlers</option>
            </select>
          </div>
        </div>

        {/* Live Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search IP address, user email, route, action, request UUID, country, city, ISP..."
            className="w-full h-9 pl-9 pr-4 text-xs bg-paper-sunken rounded-xl border border-line focus:outline-none focus:border-accent transition-colors font-medium"
          />
        </div>
      </div>

      {/* Main Forensic Ledger Table with Scroll-Based Rendering */}
      <div className="card overflow-hidden bg-white">
        <div className="p-3.5 border-b border-line bg-paper-sunken/40 flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <FileCode size={14} className="text-accent" />
            <span className="font-bold text-ink">Live Audit Stream</span>
            <span>·</span>
            <span>Displaying {logs.length} loaded records</span>
          </div>
          <span className="text-[11px] font-mono">Continuous scroll loading active</span>
        </div>

        {loading && logs.length === 0 ? (
          <div className="p-16 text-center text-ink-muted text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-accent" />
            <p>Loading cyber forensic audit ledger...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-paper-hover text-ink-muted mx-auto flex items-center justify-center mb-3">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-base font-semibold text-ink">No audit logs found</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
              {debouncedSearch || severityFilter || statusCategory
                ? 'No recorded events match your active search filters.'
                : 'The audit log stream is currently empty.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-paper-hover/60 text-[10px] font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
                  <th className="py-3 px-4">Timestamp &amp; Latency</th>
                  <th className="py-3 px-3">Severity &amp; Threats</th>
                  <th className="py-3 px-3">Method &amp; Route</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Client IP &amp; Geo Location</th>
                  <th className="py-3 px-3">Actor / User</th>
                  <th className="py-3 px-3">Device &amp; OS</th>
                  <th className="py-3 px-4 text-right">Forensics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs font-mono">
                {logs.map((log) => {
                  const hasThreats = log.threatFlags && log.threatFlags.length > 0;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-paper-hover/50 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp & Latency */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-ink text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            <span className="text-[10px] text-ink-muted">.{new Date(log.timestamp).getMilliseconds().toString().padStart(3, '0')}</span>
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                            <span>{new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            <span>·</span>
                            <span className={`font-bold ${log.latencyMs > 500 ? 'text-amber-600' : 'text-emerald-700'}`}>
                              {log.latencyMs !== null ? `${log.latencyMs}ms` : '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Severity & Threat Flags */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider ${
                              SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.INFO
                            }`}
                          >
                            {log.severity}
                          </span>

                          {hasThreats && (
                            <div className="flex flex-wrap gap-1">
                              {log.threatFlags.map((tf) => (
                                <span
                                  key={tf}
                                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[8px] font-bold"
                                >
                                  <Flame size={9} /> {tf}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Method & Route */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5 max-w-[240px]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                log.method === 'POST'
                                  ? 'bg-blue-100 text-blue-800'
                                  : log.method === 'GET'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.method === 'DELETE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {log.method}
                            </span>
                            <span className="font-sans text-[10px] text-ink-muted uppercase font-bold truncate">
                              {log.action}
                            </span>
                          </div>
                          <span className="text-ink text-[11px] font-mono truncate" title={log.fullUrl}>
                            {log.route || log.fullUrl}
                          </span>
                        </div>
                      </td>

                      {/* Status Code */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold font-mono border ${STATUS_COLOR(
                            log.statusCode
                          )}`}
                        >
                          {log.statusCode}
                        </span>
                      </td>

                      {/* Client IP & Geo Location */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-ink text-[11px] flex items-center gap-1">
                            <span>{log.ipAddress}</span>
                            {log.geoIsHosting && (
                              <span className="px-1 py-0.2 rounded bg-purple-100 text-purple-700 text-[8px] font-bold" title="Hosting / Datacenter IP">
                                VPS
                              </span>
                            )}
                            {log.geoIsProxy && (
                              <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-700 text-[8px] font-bold" title="Proxy / VPN Detected">
                                PROXY
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-ink-muted font-sans flex items-center gap-1 truncate max-w-[160px]" title={`${log.geoCity}, ${log.geoCountry} · ${log.geoOrg}`}>
                            <Globe size={11} className="shrink-0 text-accent" />
                            <span>
                              {log.geoCity ? `${log.geoCity}, ` : ''}
                              {log.geoCountry || 'Local Network'}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Actor / User */}
                      <td className="py-3 px-3 font-sans">
                        <div className="flex flex-col gap-0.5 max-w-[160px]">
                          {log.userEmail ? (
                            <>
                              <span className="font-semibold text-ink text-xs truncate" title={log.userEmail}>
                                {log.userEmail}
                              </span>
                              <span className="text-[9px] uppercase font-bold text-accent">
                                {log.userRole || 'USER'} #{log.userId}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-muted text-xs italic">Anonymous / Guest</span>
                          )}
                        </div>
                      </td>

                      {/* Device & OS */}
                      <td className="py-3 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          {DEVICE_ICON(log.deviceType, log.isBot)}
                          <div className="flex flex-col text-[11px] leading-tight min-w-0">
                            <span className="font-semibold text-ink truncate max-w-[120px]">
                              {log.deviceBrowser} {log.deviceBrowserVer}
                            </span>
                            <span className="text-[10px] text-ink-muted truncate max-w-[120px]">
                              {log.deviceOs}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-lg bg-paper-sunken group-hover:bg-accent group-hover:text-white text-ink-muted transition-colors"
                          title="View Forensic Breakdown"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} className="py-4 text-center border-t border-line bg-paper-sunken/30">
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-accent">
              <RefreshCw size={14} className="animate-spin" />
              <span>Streaming next batch of forensic logs...</span>
            </div>
          ) : hasMore ? (
            <button
              type="button"
              onClick={() => fetchLogs(false)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Load more logs ({logs.length} / {totalCount})
            </button>
          ) : (
            <span className="text-[11px] text-ink-muted">✓ End of audit ledger stream ({totalCount} total records)</span>
          )}
        </div>
      </div>

      {/* FORENSIC DEEP-DIVE MODAL */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Forensic Audit Record · ${selectedLog.requestId}` : 'Audit Record'}
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6 pt-1 font-sans text-xs">
            {/* Header Status Card */}
            <div className="p-4 rounded-2xl bg-paper-sunken border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold font-mono text-sm border shadow-xs ${STATUS_COLOR(
                    selectedLog.statusCode
                  )}`}
                >
                  {selectedLog.statusCode}
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <span className="font-mono text-accent">{selectedLog.method}</span>
                    <span className="font-mono">{selectedLog.route}</span>
                  </h3>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {formatDateTime(selectedLog.timestamp)} · Latency: {selectedLog.latencyMs}ms · Severity: {selectedLog.severity}
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  SEVERITY_COLORS[selectedLog.severity] || SEVERITY_COLORS.INFO
                }`}
              >
                {selectedLog.severity}
              </span>
            </div>

            {/* Forensics Grid (2 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Column 1: Network & Geo Location */}
              <div className="card p-4 space-y-3 bg-white">
                <h4 className="font-bold text-ink text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-line pb-2">
                  <Globe size={14} className="text-accent" /> Network &amp; Geolocation
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Client IP Address:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedLog.ipAddress, 'ip')}
                      className="font-mono font-bold text-ink hover:text-accent flex items-center gap-1"
                    >
                      <span>{selectedLog.ipAddress}</span>
                      {copiedKey === 'ip' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {selectedLog.ipForwarded && (
                    <div className="flex justify-between items-center">
                      <span className="text-ink-muted">X-Forwarded-For:</span>
                      <span className="font-mono text-[11px] text-ink-soft truncate max-w-[180px]" title={selectedLog.ipForwarded}>
                        {selectedLog.ipForwarded}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Location:</span>
                    <span className="font-semibold text-ink">
                      {selectedLog.geoCity ? `${selectedLog.geoCity}, ` : ''}
                      {selectedLog.geoRegion ? `${selectedLog.geoRegion}, ` : ''}
                      {selectedLog.geoCountry || 'Local Network'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">ISP / Organization:</span>
                    <span className="font-semibold text-ink truncate max-w-[180px]" title={selectedLog.geoOrg}>
                      {selectedLog.geoOrg || 'Private Network'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">ASN:</span>
                    <span className="font-mono text-ink">{selectedLog.geoAsn || 'AS0'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Timezone:</span>
                    <span className="text-ink">{selectedLog.geoTimezone || 'UTC'}</span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-line">
                    <span className="text-ink-muted">Proxy / VPN / VPS:</span>
                    <div className="flex gap-1.5">
                      {selectedLog.geoIsProxy && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                          PROXY / VPN
                        </span>
                      )}
                      {selectedLog.geoIsHosting && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                          DATACENTER
                        </span>
                      )}
                      {!selectedLog.geoIsProxy && !selectedLog.geoIsHosting && (
                        <span className="text-emerald-700 font-semibold">Residential / Direct</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Device & Client Signature */}
              <div className="card p-4 space-y-3 bg-white">
                <h4 className="font-bold text-ink text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-line pb-2">
                  <Fingerprint size={14} className="text-accent" /> Device &amp; Client Signature
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Device Type:</span>
                    <span className="font-semibold text-ink uppercase flex items-center gap-1">
                      {DEVICE_ICON(selectedLog.deviceType, selectedLog.isBot)}
                      {selectedLog.deviceType || 'Desktop'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Operating System:</span>
                    <span className="font-semibold text-ink">{selectedLog.deviceOs}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Browser &amp; Version:</span>
                    <span className="font-semibold text-ink">
                      {selectedLog.deviceBrowser} {selectedLog.deviceBrowserVer}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Bot / Crawler:</span>
                    <span className={`font-bold ${selectedLog.isBot ? 'text-purple-700' : 'text-ink-muted'}`}>
                      {selectedLog.isBot ? `YES (${selectedLog.botName || 'Automated'})` : 'NO'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Auth Context:</span>
                    <span className="font-semibold text-ink">
                      {selectedLog.authMethod || 'ANONYMOUS'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-line">
                    <span className="text-ink-muted">Authenticated User:</span>
                    <span className="font-semibold text-ink">
                      {selectedLog.userEmail ? `${selectedLog.userEmail} (${selectedLog.userRole})` : 'Anonymous Guest'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cyber Threat Analysis Panel */}
            {selectedLog.threatFlags && selectedLog.threatFlags.length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                <h4 className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                  <Flame size={15} className="text-rose-600" /> Active Threat Signatures Detected
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedLog.threatFlags.map((flag) => (
                    <span
                      key={flag}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-mono font-bold text-xs shadow-xs"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Request Signature & Tamper-Evident SHA-256 Hash */}
            <div className="card p-4 space-y-3 bg-white">
              <h4 className="font-bold text-ink text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-line pb-2">
                <Server size={14} className="text-accent" /> Request Forensics &amp; Body Hash
              </h4>

              <div className="space-y-2 font-mono text-[11px]">
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Request UUID</span>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-paper-sunken mt-1">
                    <span className="text-ink">{selectedLog.requestId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedLog.requestId, 'reqId')}
                      className="text-ink-muted hover:text-accent"
                    >
                      {copiedKey === 'reqId' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Full Request URL</span>
                  <div className="p-2 rounded-lg bg-paper-sunken mt-1 break-all text-ink">
                    {selectedLog.fullUrl}
                  </div>
                </div>

                {selectedLog.requestBodyHash && (
                  <div>
                    <span className="text-ink-muted block text-[10px] uppercase font-bold">SHA-256 Request Body Hash (Tamper Proof)</span>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-paper-sunken mt-1">
                      <span className="text-ink truncate max-w-[480px]">{selectedLog.requestBodyHash}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedLog.requestBodyHash, 'hash')}
                        className="text-ink-muted hover:text-accent shrink-0 ml-2"
                      >
                        {copiedKey === 'hash' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}

                {selectedLog.sessionFingerprint && (
                  <div>
                    <span className="text-ink-muted block text-[10px] uppercase font-bold">Session Correlation Fingerprint</span>
                    <div className="p-2 rounded-lg bg-paper-sunken mt-1 text-ink-muted truncate">
                      {selectedLog.sessionFingerprint}
                    </div>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <span className="text-ink-muted block text-[10px] uppercase font-bold">Raw User-Agent Header</span>
                    <div className="p-2 rounded-lg bg-paper-sunken mt-1 text-ink break-all font-sans text-xs">
                      {selectedLog.userAgent}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn btn-sm btn-secondary text-xs px-4 py-2"
              >
                Close Forensics Panel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
