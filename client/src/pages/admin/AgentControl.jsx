import { useEffect, useState, useCallback } from 'react';
import {
  Monitor,
  Printer,
  Pause,
  Play,
  RefreshCw,
  Power,
  Sliders,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Search,
  Cpu,
  Globe,
  Radio,
  FileText,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';

export default function AdminAgentControl() {
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected agent for remote control
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  // Filters for logs
  const [logSearch, setLogSearch] = useState('');
  const [logSeverity, setLogSeverity] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  // Custom command form modal/state
  const [customPrinter, setCustomPrinter] = useState('');
  const [customInterval, setCustomInterval] = useState('10');
  const [sendingCmd, setSendingCmd] = useState(false);

  const fetchAgentData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [sessRes, logsRes, cmdRes] = await Promise.all([
        api.get('/agent/sessions'),
        api.get(`/agent/logs?page=${logPage}&limit=20&severity=${logSeverity}&search=${encodeURIComponent(logSearch)}`),
        api.get('/agent/commands?limit=15'),
      ]);

      setSessions(sessRes.sessions || []);
      setLogs(logsRes.logs || []);
      setLogTotalPages(logsRes.pagination?.totalPages || 1);
      setCommands(cmdRes.commands || []);

      // Auto-select first session if none selected
      if (!selectedAgentId && sessRes.sessions?.length > 0) {
        setSelectedAgentId(sessRes.sessions[0].userId);
      }
    } catch (err) {
      toast('Failed to load printer agent status', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, logPage, logSeverity, logSearch, selectedAgentId]);

  useEffect(() => {
    fetchAgentData();
    // Auto refresh every 10 seconds for real-time remote telemetry
    const interval = setInterval(() => fetchAgentData(true), 10000);
    return () => clearInterval(interval);
  }, [fetchAgentData]);

  const sendRemoteCommand = async (commandType, payload = null, targetUserId = null) => {
    const agentId = targetUserId || selectedAgentId;
    if (!agentId) {
      toast('Please select an active agent first', 'error');
      return;
    }

    setSendingCmd(true);
    try {
      await api.post('/agent/command', {
        userId: agentId,
        commandType,
        payload,
      });
      toast(`Command '${commandType}' sent to agent`, 'success');
      fetchAgentData(true);
    } catch (err) {
      toast(err.message || 'Failed to send command', 'error');
    } finally {
      setSendingCmd(false);
    }
  };

  if (loading && sessions.length === 0) {
    return <PageLoader label="Connecting to Printer Agent telemetry server…" />;
  }

  const activeAgent = sessions.find((s) => s.userId === selectedAgentId) || sessions[0];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">
              Desktop Agent Remote Control
            </h1>
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" title="Telemetry Active" />
          </div>
          <p className="text-ink-muted text-xs sm:text-sm mt-0.5">
            Full remote administration, telemetry, command execution, &amp; activity audit for desktop printer stations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchAgentData(true)}
            disabled={refreshing}
            className="btn btn-secondary text-xs h-10 px-3.5 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Agents Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.length === 0 ? (
          <div className="col-span-full card p-8 text-center text-ink-muted bg-white border border-line rounded-2xl">
            <Monitor size={36} className="mx-auto text-ink-muted mb-2 opacity-50" />
            <p className="font-semibold text-ink text-sm">No Printer Agents Registered Yet</p>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              Launch the desktop Inks Printer Agent (`python -m src.main` in `printer-agent/`) and log in with a PRINTER_AGENT role account.
            </p>
          </div>
        ) : (
          sessions.map((sess) => {
            const isSelected = sess.userId === selectedAgentId;
            return (
              <div
                key={sess.id}
                onClick={() => setSelectedAgentId(sess.userId)}
                className={`card p-5 border rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? 'border-accent ring-2 ring-accent/20 bg-accent-soft/10 shadow-sm'
                    : 'border-line bg-white hover:border-accent/40'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        sess.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    <span className="font-bold text-ink text-sm truncate max-w-[140px]">
                      {sess.hostname || 'Desktop Station'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Force refresh status & poll station"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendRemoteCommand('FORCE_POLL', null, sess.userId);
                      }}
                      className="p-1 text-ink-muted hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                    >
                      <RefreshCw size={13} />
                    </button>
                    <span
                      className={`badge text-[10px] font-bold ${
                        sess.isOnline ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {sess.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted flex items-center gap-1.5">
                      <Cpu size={13} /> OS / Host:
                    </span>
                    <span className="font-mono text-ink font-semibold">{sess.os}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted flex items-center gap-1.5">
                      <Printer size={13} /> Printer:
                    </span>
                    <span className="font-semibold text-ink truncate max-w-[130px]">
                      {sess.printerName || 'OS Default'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted flex items-center gap-1.5">
                      <Activity size={13} /> Mode:
                    </span>
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px]">
                      {sess.autoMode ? 'Auto-Print' : 'Manual'} ({sess.pollInterval}s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-line/60">
                    <span className="text-ink-muted">Printed Today:</span>
                    <span className="font-bold text-emerald-700 tabular-nums">{sess.jobsPrinted} sheets</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active Agent Remote Control Panel */}
      {activeAgent && (
        <div className="card bg-white border border-line rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${activeAgent.isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <h2 className="font-display font-bold text-ink text-lg">
                  Control Station: {activeAgent.hostname} ({activeAgent.user?.email})
                </h2>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Last Heartbeat: {formatDateTime(activeAgent.lastHeartbeat)} · Version: {activeAgent.agentVersion} · IP: {activeAgent.ipAddress || 'Local'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`badge ${activeAgent.isPaused ? 'badge-warning' : 'badge-success'} text-xs font-bold`}>
                {activeAgent.isPaused ? 'PAUSED' : 'ACTIVE POLLING'}
              </span>
            </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => sendRemoteCommand(activeAgent.isPaused ? 'RESUME' : 'PAUSE')}
              disabled={sendingCmd || !activeAgent.isOnline}
              className={`btn text-xs h-11 inline-flex items-center justify-center gap-2 font-bold shadow-xs ${
                activeAgent.isPaused
                  ? 'btn-success'
                  : 'btn-secondary text-amber-700 hover:bg-amber-50 hover:border-amber-300'
              }`}
            >
              {activeAgent.isPaused ? <Play size={16} /> : <Pause size={16} />}
              <span>{activeAgent.isPaused ? 'Resume Polling' : 'Pause Polling'}</span>
            </button>

            <button
              type="button"
              onClick={() => sendRemoteCommand('FORCE_POLL')}
              disabled={sendingCmd || !activeAgent.isOnline}
              className="btn btn-secondary text-xs h-11 inline-flex items-center justify-center gap-2 font-bold"
            >
              <RefreshCw size={16} />
              <span>Force Immediate Poll</span>
            </button>

            <button
              type="button"
              onClick={() => sendRemoteCommand('SET_AUTO_MODE', { enabled: !activeAgent.autoMode })}
              disabled={sendingCmd || !activeAgent.isOnline}
              className="btn btn-secondary text-xs h-11 inline-flex items-center justify-center gap-2 font-bold"
            >
              <Radio size={16} />
              <span>Toggle Mode ({activeAgent.autoMode ? 'Manual' : 'Auto'})</span>
            </button>

            <button
              type="button"
              onClick={() => sendRemoteCommand('DISCONNECT')}
              disabled={sendingCmd || !activeAgent.isOnline}
              className="btn text-xs h-11 inline-flex items-center justify-center gap-2 font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
            >
              <Power size={16} />
              <span>Remote Disconnect</span>
            </button>
          </div>

          {/* Inline Parameter Tuning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-paper-sunken p-4 rounded-xl border border-line">
            {/* 1. Change Printer Target */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Printer size={14} className="text-accent" /> Change Printer Target
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPrinter}
                  onChange={(e) => setCustomPrinter(e.target.value)}
                  placeholder="e.g. HP LaserJet Pro or Microsoft Print to PDF"
                  className="field-input text-xs h-9 flex-1"
                />
                <button
                  type="button"
                  onClick={() => sendRemoteCommand('CHANGE_PRINTER', { printer: customPrinter })}
                  disabled={!customPrinter.trim() || sendingCmd || !activeAgent.isOnline}
                  className="btn btn-primary text-xs h-9 px-3 shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* 2. Change Poll Interval */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Sliders size={14} className="text-accent" /> Change Poll Frequency (Seconds)
              </label>
              <div className="flex gap-2">
                <select
                  value={customInterval}
                  onChange={(e) => setCustomInterval(e.target.value)}
                  className="field-input text-xs h-9 flex-1"
                >
                  <option value="5">5 Seconds (High Priority)</option>
                  <option value="10">10 Seconds (Standard)</option>
                  <option value="20">20 Seconds</option>
                  <option value="30">30 Seconds</option>
                  <option value="60">60 Seconds (Low Frequency)</option>
                </select>
                <button
                  type="button"
                  onClick={() => sendRemoteCommand('CHANGE_POLL_INTERVAL', { interval: parseInt(customInterval) })}
                  disabled={sendingCmd || !activeAgent.isOnline}
                  className="btn btn-primary text-xs h-9 px-3 shrink-0"
                >
                  Set Frequency
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remote Commands Dispatch History */}
      <div className="card bg-white border border-line rounded-2xl overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="font-display font-bold text-ink text-base">Dispatched Remote Commands</h3>
            <p className="text-xs text-ink-muted">Execution audit log &amp; acknowledgment status</p>
          </div>
          <span className="text-xs font-semibold text-ink-muted">{commands.length} commands logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-sunken text-ink-muted uppercase tracking-wider font-semibold border-b border-line text-[11px]">
              <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Target Station</th>
                <th className="px-4 py-2.5">Command Type</th>
                <th className="px-4 py-2.5">Payload</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {commands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-muted">
                    No remote commands sent yet.
                  </td>
                </tr>
              ) : (
                commands.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-paper-hover">
                    <td className="px-4 py-3 font-mono font-bold text-ink">#{cmd.id}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{cmd.user?.name || 'Agent'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{cmd.commandType}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-muted max-w-[200px] truncate">
                      {cmd.payload || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          cmd.isAcked ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {cmd.isAcked ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        {cmd.isAcked ? 'EXECUTED (ACK)' : 'PENDING ACK'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted">{formatDateTime(cmd.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Agent Activity Logs from Supabase */}
      <div className="card bg-white border border-line rounded-2xl overflow-hidden shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h3 className="font-display font-bold text-ink text-base">Desktop Agent Telemetry &amp; Log Stream</h3>
            <p className="text-xs text-ink-muted">Activities, print completions, and runtime errors logged from python agent instances</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={logSeverity}
              onChange={(e) => {
                setLogSeverity(e.target.value);
                setLogPage(1);
              }}
              className="field-input text-xs h-9"
            >
              <option value="">All Severities</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>

            <div className="relative w-48 sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type="search"
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setLogPage(1);
                }}
                placeholder="Search logs…"
                className="field-input pl-8 h-9 text-xs w-full"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-sunken text-ink-muted uppercase tracking-wider font-semibold border-b border-line text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Station / Agent</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Order #</th>
                <th className="px-4 py-2.5">Severity</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted font-sans">
                    No activity logs found for the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-paper-hover">
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 font-sans font-semibold text-ink">{log.user?.name || 'Agent'}</td>
                    <td className="px-4 py-3 font-bold text-indigo-700">{log.action}</td>
                    <td className="px-4 py-3 text-ink font-semibold">{log.orderNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge text-[10px] font-bold ${
                          log.severity === 'ERROR'
                            ? 'badge-danger'
                            : log.severity === 'WARN'
                            ? 'badge-warning'
                            : 'badge-neutral'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft max-w-md truncate font-sans">{log.details || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {logTotalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-line">
            <span className="text-xs text-ink-muted">Page {logPage} of {logTotalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                disabled={logPage === 1}
                className="btn btn-secondary text-xs h-8 px-3"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                disabled={logPage === logTotalPages}
                className="btn btn-secondary text-xs h-8 px-3"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
