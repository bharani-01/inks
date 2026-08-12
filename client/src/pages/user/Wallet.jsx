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
  ShieldCheck,
  PlusCircle,
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10 px-1 sm:px-0">
      {/* Custom Graphic Hero Balance Card */}
      <div
        className="relative overflow-hidden rounded-3xl text-white shadow-xl p-6 sm:p-8 border border-white/20 bg-cover bg-center min-h-[170px] sm:min-h-[200px] flex flex-col justify-between"
        style={{ backgroundImage: "url('/illustrations/wallet-card-bg.webp')" }}
      >
        {/* Subtle overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/40 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm">
                <WalletIcon size={19} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/90 drop-shadow-xs">
                Ink Wallet Balance
              </span>
            </div>

            <div className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-display text-white drop-shadow-md">
              {loading ? (
                <span className="opacity-60 animate-pulse">₹ ...</span>
              ) : (
                formatMoneyIN(wallet?.balance || 0)
              )}
            </div>

            <p className="text-xs text-white/80 max-w-sm leading-relaxed drop-shadow-xs font-medium">
              Available credits for instant 1-click print checkout without scanning UPI QR.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/user/print"
              className="btn bg-white text-ink hover:bg-slate-100 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg inline-flex items-center gap-2 transition-all active:scale-95"
            >
              <Zap size={16} className="text-accent fill-accent" />
              <span>Print Now</span>
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="h-10 w-10 sm:w-auto sm:px-3.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all shadow-sm"
              title="Refresh Wallet Balance"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="card border border-line rounded-2xl overflow-hidden shadow-2xs">
        {/* Header & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-line space-y-3 bg-paper-sunken/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-accent" />
              <h2 className="text-sm sm:text-base font-bold text-ink">Transaction History</h2>
              <span className="text-xs text-ink-muted font-medium bg-line/60 px-2 py-0.5 rounded-full">
                {pagination.total}
              </span>
            </div>

            {/* Filter Pills */}
            <div className="inline-flex rounded-xl bg-paper-hover p-1 border border-line text-xs font-medium">
              <button
                type="button"
                onClick={() => setTypeFilter('')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  typeFilter === '' ? 'bg-white text-ink font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('CREDIT')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  typeFilter === 'CREDIT' ? 'bg-white text-emerald-700 font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Top-Ups
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('DEBIT')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  typeFilter === 'DEBIT' ? 'bg-white text-rose-700 font-semibold shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Debits
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference ID or note..."
              className="w-full h-9 pl-8 pr-3 text-xs bg-white rounded-xl border border-line focus:outline-none focus:border-accent shadow-2xs transition-all"
            />
          </div>
        </div>

        {/* Transactions Body */}
        {loading && transactions.length === 0 ? (
          <div className="p-12 text-center text-ink-muted text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw size={22} className="animate-spin text-accent" />
            <p className="text-xs">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-paper-hover text-ink-muted mx-auto flex items-center justify-center">
              <Receipt size={24} />
            </div>
            <h3 className="text-sm font-semibold text-ink">No transactions found</h3>
            <p className="text-xs text-ink-muted max-w-xs mx-auto">
              {search || typeFilter
                ? 'No transactions matching your search filter.'
                : 'Your wallet has no transaction records yet.'}
            </p>
          </div>
        ) : (
          <div>
            {/* Mobile View: Stacked Responsive Cards */}
            <div className="block sm:hidden divide-y divide-line">
              {transactions.map((tx) => {
                const isCredit = tx.type === 'CREDIT';
                return (
                  <div key={tx.id} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-ink text-xs truncate">
                            {tx.description || (isCredit ? 'Wallet Top-Up' : 'Order Payment')}
                          </p>
                          <p className="text-[11px] text-ink-muted mt-0.5">
                            {formatDateTime(tx.createdAt)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-sm font-extrabold font-mono shrink-0 ${
                          isCredit ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-line/50">
                      <button
                        type="button"
                        onClick={() => handleCopy(tx.txnNumber || tx.referenceId, tx.id)}
                        className="font-mono text-ink-muted hover:text-accent flex items-center gap-1"
                      >
                        <span>{tx.txnNumber || tx.referenceId || `TXN-${tx.id}`}</span>
                        {copiedTxn === tx.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>

                      {tx.refType === 'ORDER' && tx.referenceId && (
                        <Link
                          to={`/user/orders?track=${tx.referenceId}`}
                          className="text-accent font-semibold flex items-center gap-0.5 hover:underline"
                        >
                          View Order <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Spacious Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-paper-sunken/60 text-[11px] font-bold text-ink-muted uppercase tracking-wider border-b border-line">
                    <th className="py-3 px-6">Description</th>
                    <th className="py-3 px-4">Reference ID</th>
                    <th className="py-3 px-4 text-center">Balance Flow</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-6 text-right">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {transactions.map((tx) => {
                    const isCredit = tx.type === 'CREDIT';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Description */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}
                            >
                              {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink truncate max-w-xs">
                                {tx.description || (isCredit ? 'Wallet Top-Up' : 'Order Payment')}
                              </p>
                              {tx.refType === 'ORDER' && tx.referenceId && (
                                <Link
                                  to={`/user/orders?track=${tx.referenceId}`}
                                  className="text-[11px] text-accent hover:underline inline-flex items-center gap-0.5 mt-0.5 font-medium"
                                >
                                  View Order Details <ExternalLink size={10} />
                                </Link>
                              )}
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
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-paper-sunken border border-line text-[11px] font-mono">
                            <span className="text-ink-muted">₹{Number(tx.balanceBefore || 0).toFixed(2)}</span>
                            <span className="text-ink-muted">→</span>
                            <span className="font-bold text-ink">₹{Number(tx.balanceAfter || 0).toFixed(2)}</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span
                            className={`text-sm font-bold ${
                              isCredit ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-6 text-right whitespace-nowrap text-ink-muted text-[11px]">
                          {formatDateTime(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
