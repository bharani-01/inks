import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatMoneyIN, formatDateTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Receipt,
  Layers,
  HelpCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  CreditCard,
} from 'lucide-react';

export default function UserWallet() {
  const { user } = useAuth();
  const toast = useToast();

  const [wallet, setWallet] = useState(null);
  const [stats, setStats] = useState({ totalCredited: 0, totalSpent: 0, totalTxCount: 0 });
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [copiedTxn, setCopiedTxn] = useState(null);

  const fetchWallet = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const res = await api.get('/wallet');
      setWallet(res.wallet || { balance: 0 });
      if (res.stats) setStats(res.stats);
    } catch (err) {
      toast(err.message || 'Failed to load wallet balance', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  const fetchTransactions = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
          ...(typeFilter ? { type: typeFilter } : {}),
          ...(search ? { search } : {}),
        });

        const res = await api.get(`/wallet/transactions?${params.toString()}`);
        setTransactions(res.transactions || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
      }
    },
    [typeFilter, search]
  );

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTxn(id);
    toast('Transaction Reference ID copied!', 'success');
    setTimeout(() => setCopiedTxn(null), 2000);
  };

  const handleRefresh = () => {
    fetchWallet(true);
    fetchTransactions(pagination.page);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <WalletIcon size={20} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Ink Wallet</h1>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Pre-loaded digital printing credits for instant, zero-delay 1-click checkouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-ink-soft bg-white hover:bg-paper-hover border border-line rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-accent' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to="/user/print"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl shadow-sm transition-colors"
          >
            <Zap size={16} />
            <span>Print Now</span>
          </Link>
        </div>
      </div>

      {/* Top Section: Digital Card + Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Virtual Ink Card */}
        <div className="lg:col-span-6 xl:col-span-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA] p-7 text-white shadow-xl shadow-indigo-950/20 border border-white/10 min-h-[240px] flex flex-col justify-between group">
            {/* Glassmorphic Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-violet-400/15 blur-3xl pointer-events-none" />

            {/* Top row: Brand & Chips */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                  <WalletIcon size={18} />
                </div>
                <span className="font-bold tracking-tight text-base text-white/95">INK WALLET</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE &amp; SECURED
                </span>
              </div>
            </div>

            {/* Middle: Live Balance */}
            <div className="relative z-10 my-4">
              <p className="text-xs font-medium text-indigo-200/80 uppercase tracking-wider mb-1">
                Available Print Balance
              </p>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {loading ? (
                  <span className="animate-pulse opacity-70">₹ ...</span>
                ) : (
                  formatMoneyIN(wallet?.balance || 0)
                )}
              </div>
            </div>

            {/* Bottom Row: User Details & ID */}
            <div className="relative z-10 flex items-end justify-between pt-3 border-t border-white/15 text-xs text-indigo-100/90">
              <div>
                <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">Account Holder</p>
                <p className="font-semibold text-white truncate max-w-[180px]">{user?.name || 'Customer'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">Wallet ID</p>
                <p className="font-mono font-medium text-white/90">#WLT-{String(user?.id || 0).padStart(4, '0')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Summary Stats & Quick Info */}
        <div className="lg:col-span-6 xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Added</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowDownLeft size={17} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-ink">
                {loading ? '...' : formatMoneyIN(stats.totalCredited || 0)}
              </div>
              <p className="text-xs text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
                <span>Top-ups credited by admin</span>
              </p>
            </div>
          </div>

          <div className="card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Spent</span>
              <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowUpRight size={17} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-ink">
                {loading ? '...' : formatMoneyIN(stats.totalSpent || 0)}
              </div>
              <p className="text-xs text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                <span>Used for print orders</span>
              </p>
            </div>
          </div>

          <div className="card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Transactions</span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Receipt size={17} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-ink">
                {loading ? '...' : (stats.totalTxCount || 0).toLocaleString()}
              </div>
              <p className="text-xs text-ink-muted mt-0.5 font-medium">
                <span>Full audited ledger</span>
              </p>
            </div>
          </div>

          {/* Quick Notice Banner span 3 */}
          <div className="sm:col-span-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-900 flex items-start gap-3">
            <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-900">How do Ink Wallet Top-Ups work?</p>
              <p className="text-amber-800 leading-relaxed">
                Store administrators can credit funds directly to your wallet account during semester allocations, lab prepayments, or manual top-up requests. Wallet balance can be redeemed immediately during order checkout with zero processing fees.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="card overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-accent" />
            <h2 className="text-base font-bold text-ink">Transaction History</h2>
            <span className="text-xs text-ink-muted font-medium ml-1">
              ({pagination.total} {pagination.total === 1 ? 'record' : 'records'})
            </span>
          </div>

          {/* Type filters + Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter pills */}
            <div className="inline-flex rounded-xl bg-paper-hover p-1 border border-line text-xs font-medium">
              <button
                type="button"
                onClick={() => setTypeFilter('')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  typeFilter === '' ? 'bg-white text-ink font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('CREDIT')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  typeFilter === 'CREDIT' ? 'bg-white text-emerald-700 font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Top-Ups
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('DEBIT')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  typeFilter === 'DEBIT' ? 'bg-white text-rose-700 font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Debits
              </button>
            </div>

            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference or note..."
                className="w-full h-9 pl-8 pr-3 text-xs bg-paper-hover rounded-xl border border-line focus:outline-none focus:border-accent focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table / List */}
        {loading && transactions.length === 0 ? (
          <div className="p-12 text-center text-ink-muted text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-accent" />
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-paper-hover text-ink-muted mx-auto flex items-center justify-center mb-3">
              <Receipt size={24} />
            </div>
            <h3 className="text-base font-semibold text-ink">No transactions found</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
              {search || typeFilter
                ? 'No transactions matching your search query or selected filter.'
                : 'Your wallet has no transaction records yet. Top-up credits or print orders will be recorded here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-paper-hover/60 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Type &amp; Description</th>
                  <th className="py-3 px-4">Transaction ID &amp; Ref</th>
                  <th className="py-3 px-4 text-center">Balance Flow</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT';
                  return (
                    <tr key={tx.id} className="hover:bg-paper-hover/40 transition-colors">
                      {/* Type & Description */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate max-w-[260px]">
                              {tx.description || (isCredit ? 'Wallet Top-Up' : 'Order Payment')}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  isCredit
                                    ? 'bg-emerald-100/70 text-emerald-800'
                                    : 'bg-rose-100/70 text-rose-800'
                                }`}
                              >
                                {tx.type}
                              </span>
                              {tx.refType === 'ORDER' && tx.refId && (
                                <Link
                                  to={`/user/orders?track=${tx.referenceId || ''}`}
                                  className="text-[11px] text-accent hover:underline inline-flex items-center gap-0.5"
                                >
                                  View Order <ExternalLink size={10} />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Transaction ID & Ref with copy */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(tx.txnNumber || `TXN-${tx.id}`, tx.id)}
                            className="inline-flex items-center gap-1 font-mono font-semibold text-ink-soft hover:text-accent group text-left w-fit"
                            title="Click to copy Transaction ID"
                          >
                            <span>{tx.txnNumber || `TXN-WLT-${tx.id}`}</span>
                            {copiedTxn === tx.id ? (
                              <Check size={12} className="text-emerald-600 shrink-0" />
                            ) : (
                              <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted shrink-0" />
                            )}
                          </button>

                          {tx.referenceId && tx.referenceId !== tx.txnNumber && (
                            <span className="text-[10px] text-ink-muted font-mono">
                              Ref: {tx.referenceId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Balance Flow */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-paper-hover border border-line text-[11px] font-mono">
                          <span className="text-ink-muted">₹{Number(tx.balanceBefore || 0).toFixed(2)}</span>
                          <span className="text-ink-muted">→</span>
                          <span className="font-semibold text-ink">₹{Number(tx.balanceAfter || 0).toFixed(2)}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right">
                        <span
                          className={`text-sm font-bold tracking-tight font-mono ${
                            isCredit ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <span className="text-xs text-ink-muted whitespace-nowrap">
                          {formatDateTime(tx.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-line">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchTransactions(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
