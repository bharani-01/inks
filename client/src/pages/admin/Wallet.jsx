import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { formatMoneyIN, formatDateTime } from '../../lib/format';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import {
  Wallet as WalletIcon,
  Search,
  RefreshCw,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Users,
  Receipt,
  Copy,
  Check,
  TrendingUp,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function AdminWallet() {
  const toast = useToast();

  // Active view tab: 'USERS' | 'TRANSACTIONS'
  const [activeTab, setActiveTab] = useState('USERS');

  // Stats
  const [stats, setStats] = useState({
    totalWalletsCount: 0,
    totalCirculation: 0,
    totalCredits: 0,
    totalSpent: 0,
    todayCredits: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Users Directory Tab State
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState('balance_desc');
  const [usersLoading, setUsersLoading] = useState(true);

  // Master Transactions Ledger Tab State
  const [transactions, setTransactions] = useState([]);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [txLoading, setTxLoading] = useState(true);

  // Top Up Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPickerSearch, setUserPickerSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [amount, setAmount] = useState('');
  const [customRef, setCustomRef] = useState('');
  const [note, setNote] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);

  const [copiedId, setCopiedId] = useState(null);

  // Fetch Global Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/wallet/admin/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to fetch wallet stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Users Wallets
  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setUsersLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: '15',
          sortBy: userSortBy,
          ...(userSearch ? { search: userSearch } : {}),
        });
        const res = await api.get(`/wallet/admin?${params.toString()}`);
        setUsers(res.users || []);
        if (res.pagination) setUsersPagination(res.pagination);
      } catch (err) {
        toast(err.message || 'Failed to fetch user wallets', 'error');
      } finally {
        setUsersLoading(false);
      }
    },
    [userSearch, userSortBy, toast]
  );

  // Fetch Master Transactions Ledger
  const fetchTransactions = useCallback(
    async (page = 1) => {
      try {
        setTxLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: '15',
          ...(txTypeFilter ? { type: txTypeFilter } : {}),
          ...(txSearch ? { search: txSearch } : {}),
        });
        const res = await api.get(`/wallet/admin/transactions?${params.toString()}`);
        setTransactions(res.transactions || []);
        if (res.pagination) setTxPagination(res.pagination);
      } catch (err) {
        toast(err.message || 'Failed to fetch transaction ledger', 'error');
      } finally {
        setTxLoading(false);
      }
    },
    [txTypeFilter, txSearch, toast]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'USERS') {
      fetchUsers(1);
    } else {
      fetchTransactions(1);
    }
  }, [activeTab, fetchUsers, fetchTransactions]);

  // Live search users for Topup Modal
  useEffect(() => {
    if (!modalOpen || !userPickerSearch.trim()) {
      setUserSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const res = await api.get(`/wallet/admin?search=${encodeURIComponent(userPickerSearch.trim())}&limit=5`);
        setUserSearchResults(res.users || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [userPickerSearch, modalOpen]);

  const handleOpenTopup = (preselectedUser = null) => {
    setSelectedUser(preselectedUser);
    setUserPickerSearch(preselectedUser ? preselectedUser.name : '');
    setUserSearchResults([]);
    setAmount('');
    setCustomRef('');
    setNote('');
    setModalOpen(true);
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmitTopup = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      toast('Please select a target user account', 'error');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1 || numAmount > 50000) {
      toast('Please enter a valid amount between ₹1 and ₹50,000', 'error');
      return;
    }

    setSubmittingTopup(true);
    try {
      const res = await api.post('/wallet/admin/topup', {
        userId: selectedUser.id,
        amount: numAmount,
        note: note.trim() || undefined,
        referenceId: customRef.trim() || undefined,
      });

      toast(res.message || `Successfully credited ₹${numAmount} to ${selectedUser.name}'s wallet!`, 'success');
      setModalOpen(false);
      fetchStats();
      if (activeTab === 'USERS') fetchUsers(usersPagination.page);
      else fetchTransactions(txPagination.page);
    } catch (err) {
      toast(err.message || 'Failed to top-up wallet', 'error');
    } finally {
      setSubmittingTopup(false);
    }
  };

  const PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <WalletIcon size={20} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Wallet Management</h1>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Top up customer balances, manage digital print credits, and audit all transactions with immutable references.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              if (activeTab === 'USERS') fetchUsers(usersPagination.page);
              else fetchTransactions(txPagination.page);
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-ink-soft bg-white hover:bg-paper-hover border border-line rounded-xl shadow-xs transition-colors"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTopup()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} />
            <span>Credit User Wallet</span>
          </button>
        </div>
      </div>

      {/* Global Stat Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total in Circulation</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {statsLoading ? '...' : formatMoneyIN(stats.totalCirculation)}
            </div>
            <p className="text-xs text-ink-muted mt-0.5 font-medium">Across all customer accounts</p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Credited</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700">
              {statsLoading ? '...' : formatMoneyIN(stats.totalCredits)}
            </div>
            <p className="text-xs text-emerald-600 mt-0.5 font-medium">All-time top-ups added</p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Spent on Prints</span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700">
              {statsLoading ? '...' : formatMoneyIN(stats.totalSpent)}
            </div>
            <p className="text-xs text-rose-600 mt-0.5 font-medium">Redeemed for completed jobs</p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Credited Today</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700">
              {statsLoading ? '...' : formatMoneyIN(stats.todayCredits)}
            </div>
            <p className="text-xs text-amber-600 mt-0.5 font-medium">Top-ups processed today</p>
          </div>
        </div>
      </div>

      {/* Main View Segmented Tabs */}
      <div className="card overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper-sunken/40">
          <div className="inline-flex rounded-xl bg-white p-1 border border-line text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('USERS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'USERS' ? 'bg-accent text-white shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Users size={15} />
              <span>Customer Wallets ({usersPagination.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'TRANSACTIONS' ? 'bg-accent text-white shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Receipt size={15} />
              <span>Master Transaction Ledger ({txPagination.total})</span>
            </button>
          </div>

          {/* Tab Specific Filters */}
          {activeTab === 'USERS' ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={userSortBy}
                onChange={(e) => setUserSortBy(e.target.value)}
                className="h-9 px-3 text-xs bg-white rounded-xl border border-line font-medium text-ink focus:outline-none focus:border-accent"
              >
                <option value="balance_desc">Highest Balance First</option>
                <option value="balance_asc">Lowest Balance First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="created_desc">Recently Registered</option>
              </select>

              <div className="relative min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user name or email..."
                  className="w-full h-9 pl-8 pr-3 text-xs bg-white rounded-xl border border-line focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex rounded-xl bg-white p-1 border border-line text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    txTypeFilter === '' ? 'bg-paper-hover text-ink font-semibold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('CREDIT')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    txTypeFilter === 'CREDIT' ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Credits
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('DEBIT')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    txTypeFilter === 'DEBIT' ? 'bg-rose-50 text-rose-800 font-semibold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Debits
                </button>
              </div>

              <div className="relative min-w-[240px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search Txn ID, Ref ID, User or Note..."
                  className="w-full h-9 pl-8 pr-3 text-xs bg-white rounded-xl border border-line focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: USERS DIRECTORY TABLE */}
        {activeTab === 'USERS' && (
          <div>
            {usersLoading && users.length === 0 ? (
              <div className="p-12 text-center text-ink-muted text-sm flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-accent" />
                <p>Loading customer wallets...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-12 w-12 rounded-2xl bg-paper-hover text-ink-muted mx-auto flex items-center justify-center mb-3">
                  <Users size={24} />
                </div>
                <h3 className="text-base font-semibold text-ink">No users found</h3>
                <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
                  {userSearch ? 'No customer accounts matching your search.' : 'No registered users available yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-paper-hover/60 text-[11px] font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
                      <th className="py-3 px-4 sm:px-6">Customer</th>
                      <th className="py-3 px-4">Current Balance</th>
                      <th className="py-3 px-4 text-center">Orders &amp; Docs</th>
                      <th className="py-3 px-4 text-center">Wallet Activity</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {users.map((u) => {
                      const hasBalance = u.balance > 0;
                      return (
                        <tr key={u.id} className="hover:bg-paper-hover/40 transition-colors">
                          {/* Customer */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {u.name ? u.name.charAt(0) : 'U'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-ink truncate max-w-[200px]">{u.name}</p>
                                <p className="text-[11px] text-ink-muted truncate max-w-[200px]">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Balance */}
                          <td className="py-4 px-4">
                            <span
                              className={`text-sm font-mono font-bold ${
                                hasBalance ? 'text-emerald-700 font-extrabold' : 'text-ink-muted'
                              }`}
                            >
                              {formatMoneyIN(u.balance)}
                            </span>
                          </td>

                          {/* Orders & Docs */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-2 text-[11px] text-ink-muted">
                              <span>
                                <strong className="text-ink">{u.totalOrders}</strong> orders
                              </span>
                              <span>·</span>
                              <span>
                                <strong className="text-ink">{u.totalDocuments}</strong> docs
                              </span>
                            </div>
                          </td>

                          {/* Wallet Activity */}
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-paper border border-line text-ink-soft">
                              {u.transactionCount} transactions
                            </span>
                          </td>

                          {/* Action Topup Button */}
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenTopup(u)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white hover:bg-accent-hover text-xs font-semibold shadow-2xs transition-colors"
                            >
                              <Plus size={13} />
                              <span>Top Up</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {usersPagination.totalPages > 1 && (
              <div className="p-4 border-t border-line">
                <Pagination
                  currentPage={usersPagination.page}
                  totalPages={usersPagination.totalPages}
                  total={usersPagination.total}
                  onPageChange={(p) => fetchUsers(p)}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MASTER AUDIT LEDGER */}
        {activeTab === 'TRANSACTIONS' && (
          <div>
            {txLoading && transactions.length === 0 ? (
              <div className="p-12 text-center text-ink-muted text-sm flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-accent" />
                <p>Loading master transaction ledger...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-12 w-12 rounded-2xl bg-paper-hover text-ink-muted mx-auto flex items-center justify-center mb-3">
                  <Receipt size={24} />
                </div>
                <h3 className="text-base font-semibold text-ink">No transactions found</h3>
                <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
                  {txSearch || txTypeFilter
                    ? 'No records matching your search query or filter.'
                    : 'The transaction ledger is currently empty.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-paper-hover/60 text-[11px] font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
                      <th className="py-3 px-4 sm:px-6">Txn ID &amp; Ref</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Type &amp; Note</th>
                      <th className="py-3 px-4 text-center">Balance Flow</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Initiated By</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {transactions.map((tx) => {
                      const isCredit = tx.type === 'CREDIT';
                      return (
                        <tr key={tx.id} className="hover:bg-paper-hover/40 transition-colors">
                          {/* Txn ID & Reference */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => handleCopy(tx.txnNumber || `TXN-${tx.id}`, tx.id)}
                                className="inline-flex items-center gap-1 font-mono font-semibold text-ink-soft hover:text-accent group text-left w-fit"
                                title="Click to copy Transaction ID"
                              >
                                <span>{tx.txnNumber || `TXN-WLT-${tx.id}`}</span>
                                {copiedId === tx.id ? (
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

                          {/* User */}
                          <td className="py-4 px-4">
                            <div className="min-w-0">
                              <p className="font-semibold text-ink truncate max-w-[150px]">
                                {tx.user?.name || 'Customer'}
                              </p>
                              <p className="text-[10px] text-ink-muted truncate max-w-[150px]">
                                {tx.user?.email}
                              </p>
                            </div>
                          </td>

                          {/* Type & Note */}
                          <td className="py-4 px-4">
                            <div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isCredit
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {tx.type}
                              </span>
                              <p className="font-medium text-ink-soft mt-1 truncate max-w-[200px]" title={tx.description}>
                                {tx.description || (isCredit ? 'Admin Top-Up' : 'Order Payment')}
                              </p>
                            </div>
                          </td>

                          {/* Balance Flow */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-paper-hover border border-line text-[11px] font-mono">
                              <span className="text-ink-muted">₹{Number(tx.balanceBefore || 0).toFixed(2)}</span>
                              <span className="text-ink-muted">→</span>
                              <span className="font-semibold text-ink">₹{Number(tx.balanceAfter || 0).toFixed(2)}</span>
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-4 px-4 text-right">
                            <span
                              className={`text-sm font-bold font-mono ${
                                isCredit ? 'text-emerald-700 font-extrabold' : 'text-rose-600'
                              }`}
                            >
                              {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                            </span>
                          </td>

                          {/* Initiated By */}
                          <td className="py-4 px-4">
                            <span className="text-[11px] font-medium text-ink-soft">
                              {isCredit
                                ? tx.adminCreator?.name || 'Store Admin'
                                : 'Self (Customer Checkout)'}
                            </span>
                          </td>

                          {/* Date & Time */}
                          <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap text-ink-muted">
                            {formatDateTime(tx.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {txPagination.totalPages > 1 && (
              <div className="p-4 border-t border-line">
                <Pagination
                  currentPage={txPagination.page}
                  totalPages={txPagination.totalPages}
                  total={txPagination.total}
                  onPageChange={(p) => fetchTransactions(p)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOP-UP MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Credit Customer Ink Wallet"
      >
        <form onSubmit={handleSubmitTopup} className="space-y-4 pt-1">
          {/* User selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink">
              Select Customer Account <span className="text-danger">*</span>
            </label>
            {selectedUser ? (
              <div className="p-3 rounded-xl bg-accent-soft/40 border border-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                    {selectedUser.name ? selectedUser.name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">{selectedUser.name}</p>
                    <p className="text-[11px] text-ink-muted">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-line">
                    Current: {formatMoneyIN(selectedUser.balance || 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setUserPickerSearch('');
                    }}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={userPickerSearch}
                  onChange={(e) => setUserPickerSearch(e.target.value)}
                  placeholder="Type name or email to search customer..."
                  className="w-full h-10 pl-9 pr-3 text-xs bg-white rounded-xl border border-line focus:outline-none focus:border-accent"
                />
                {searchingUsers && (
                  <RefreshCw size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-accent" />
                )}

                {/* Dropdown results */}
                {userSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-line shadow-pop max-h-48 overflow-y-auto z-50 divide-y divide-line">
                    {userSearchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(u);
                          setUserSearchResults([]);
                        }}
                        className="w-full p-2.5 text-left hover:bg-paper-hover flex items-center justify-between transition-colors text-xs"
                      >
                        <div>
                          <p className="font-semibold text-ink">{u.name}</p>
                          <p className="text-[11px] text-ink-muted">{u.email}</p>
                        </div>
                        <span className="font-mono text-emerald-700 font-semibold">
                          {formatMoneyIN(u.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount input & presets */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink">
              Top-Up Amount (₹) <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-ink-muted text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                max="50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (e.g. 500)"
                className="w-full h-11 pl-8 pr-3 text-sm font-mono font-bold text-ink bg-white rounded-xl border border-line focus:outline-none focus:border-accent"
                required
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {PRESET_AMOUNTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-paper-hover hover:bg-accent-soft hover:text-accent border border-line transition-colors"
                >
                  +₹{p}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reference ID (Optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink">
              Custom Reference ID <span className="text-ink-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={customRef}
              onChange={(e) => setCustomRef(e.target.value)}
              placeholder="e.g. SEM-ALLOCATION-2026, LAB-VOUCHER"
              className="w-full h-9 px-3 text-xs bg-white rounded-xl border border-line focus:outline-none focus:border-accent font-mono"
            />
            <p className="text-[10px] text-ink-muted">
              Auto-generated if left empty. Can be searched in the master ledger.
            </p>
          </div>

          {/* Note / Description */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink">
              Reason / Note for Customer
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Semester printing allocation, Jam refund"
              className="w-full h-9 px-3 text-xs bg-white rounded-xl border border-line focus:outline-none focus:border-accent"
            />
          </div>

          {/* Projected Balance Preview */}
          {selectedUser && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-xl bg-paper border border-line text-xs flex justify-between items-center">
              <span className="text-ink-muted">Projected Balance After Credit:</span>
              <span className="font-mono font-bold text-sm text-emerald-700">
                {formatMoneyIN(selectedUser.balance + parseFloat(amount))}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-soft hover:bg-paper-hover border border-line transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingTopup || !selectedUser || !amount}
              className="btn btn-primary text-xs py-2 px-5 font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {submittingTopup ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Processing Top-Up...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Credit {amount ? `₹${amount}` : 'Wallet'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
