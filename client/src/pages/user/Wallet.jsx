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
  Zap,
  Receipt,
  ExternalLink,
} from 'lucide-react';

export default function UserWallet() {
  const { user } = useAuth();
  const toast = useToast();

  const [wallet, setWallet] = useState(null);
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
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Top Simple Balance Card */}
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#3730A3] text-white shadow-lg border border-white/10 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                <WalletIcon size={18} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Ink Wallet Balance
              </span>
            </div>

            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-display">
              {loading ? (
                <span className="opacity-70 animate-pulse">₹ ...</span>
              ) : (
                formatMoneyIN(wallet?.balance || 0)
              )}
            </div>

            <p className="text-xs text-indigo-200/90 max-w-md pt-0.5">
              Available credits for instant 1-click print checkout. Top-ups are managed by store administrators.
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-2.5 shrink-0 pt-2 sm:pt-0">
            <Link
              to="/user/print"
              className="btn bg-white text-ink hover:bg-slate-100 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
            >
              <Zap size={16} className="text-accent" />
              <span>Print Now</span>
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-100 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="card overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt size={17} className="text-accent" />
            <h2 className="text-sm sm:text-base font-bold text-ink">Transaction History</h2>
            <span className="text-xs text-ink-muted font-medium ml-1">
              ({pagination.total})
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
            <RefreshCw size={22} className="animate-spin text-accent" />
            <p className="text-xs">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-11 w-11 rounded-2xl bg-paper-hover text-ink-muted mx-auto flex items-center justify-center mb-3">
              <Receipt size={22} />
            </div>
            <h3 className="text-sm font-semibold text-ink">No transactions found</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
              {search || typeFilter
                ? 'No transactions matching your search query or selected filter.'
                : 'Your wallet has no transaction records yet. Top-ups and order payments will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-paper-hover/60 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Description</th>
                  <th className="py-3 px-4">Reference ID</th>
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
                      {/* Description */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate max-w-[240px]">
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
                              {tx.refType === 'ORDER' && tx.referenceId && (
                                <Link
                                  to={`/user/orders?track=${tx.referenceId}`}
                                  className="text-[11px] text-accent hover:underline inline-flex items-center gap-0.5"
                                >
                                  View Order <ExternalLink size={10} />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Reference ID with 1-click copy */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleCopy(tx.txnNumber || tx.referenceId, tx.id)}
                          className="inline-flex items-center gap-1 font-mono font-semibold text-ink-soft hover:text-accent group text-left"
                          title="Click to copy Reference ID"
                        >
                          <span>{tx.txnNumber || tx.referenceId || `TXN-${tx.id}`}</span>
                          {copiedTxn === tx.id ? (
                            <Check size={12} className="text-emerald-600 shrink-0" />
                          ) : (
                            <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted shrink-0" />
                          )}
                        </button>
                      </td>

                      {/* Balance Flow */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-paper-hover border border-line text-[11px] font-mono">
                          <span className="text-ink-muted">₹{Number(tx.balanceBefore || 0).toFixed(2)}</span>
                          <span className="text-ink-muted">→</span>
                          <span className="font-semibold text-ink">₹{Number(tx.balanceAfter || 0).toFixed(2)}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono ${
                            isCredit ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap text-ink-muted text-[11px]">
                        {formatDateTime(tx.createdAt)}
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
