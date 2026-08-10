import { useState, useEffect, useMemo } from 'react';
import { api, invoiceUrl } from '../../lib/api';
import { formatMoney, formatDateTime, formatDate } from '../../lib/format';
import { useToast } from '../../components/Toaster';
import Modal from '../../components/Modal';
import Field from '../../components/Field';
import Button from '../../components/Button';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Copy,
  Check,
  Download,
  Settings,
  ShieldCheck,
  Send,
  Eye,
  ExternalLink,
  Smartphone,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Users,
  Package
} from 'lucide-react';

export default function Payments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'verified' | 'rejected' | 'settings'
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  // Verification & Rejection action state
  const [actionOrder, setActionOrder] = useState(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Payment not received in merchant UPI account');
  const [processingAction, setProcessingAction] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(null);

  // UPI Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    merchantUpiId: '',
    merchantName: '',
    autoApprovePayments: false
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchPayments = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await api.get('/orders/admin/payments');
      setData(res);
      if (res?.merchantUpi) {
        setSettingsForm({
          merchantUpiId: res.merchantUpi.merchantUpiId || '',
          merchantName: res.merchantUpi.merchantName || '',
          autoApprovePayments: Boolean(res.merchantUpi.autoApprovePayments)
        });
      }
      if (isRefresh) toast('Payments data refreshed', 'success');
    } catch (err) {
      toast(err.message || 'Failed to load payments data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyUtr = (utr) => {
    if (!utr) return;
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    toast(`UTR ${utr} copied!`, 'success');
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleApprove = async () => {
    if (!actionOrder) return;
    setProcessingAction(true);
    try {
      await api.post(`/orders/admin/${actionOrder.id}/verify-payment`);
      toast(`Payment verified! Invoice emailed to ${actionOrder.user?.email || 'customer'}.`, 'success');
      setVerifyModalOpen(false);
      setActionOrder(null);
      fetchPayments(true);
    } catch (err) {
      toast(err.message || 'Failed to verify payment', 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async () => {
    if (!actionOrder) return;
    setProcessingAction(true);
    try {
      await api.post(`/orders/admin/${actionOrder.id}/reject-payment`, {
        reason: rejectReason.trim()
      });
      toast(`Payment rejected. Reinitiate email sent to ${actionOrder.user?.email || 'customer'}.`, 'warning');
      setRejectModalOpen(false);
      setActionOrder(null);
      fetchPayments(true);
    } catch (err) {
      toast(err.message || 'Failed to reject payment', 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/settings/pricing', {
        merchantUpiId: settingsForm.merchantUpiId,
        merchantName: settingsForm.merchantName,
        autoApprovePayments: settingsForm.autoApprovePayments
      });
      toast('Merchant UPI settings updated successfully!', 'success');
      fetchPayments(true);
    } catch (err) {
      toast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered lists
  const pendingOrders = useMemo(() => {
    const list = data?.pending || [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.user?.name?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.upiRefNumber?.toLowerCase().includes(q)
    );
  }, [data?.pending, searchTerm]);

  const verifiedOrders = useMemo(() => {
    const list = data?.verified || [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.user?.name?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.upiRefNumber?.toLowerCase().includes(q)
    );
  }, [data?.verified, searchTerm]);

  const rejectedOrders = useMemo(() => {
    const list = data?.rejected || [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.user?.name?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.paymentRejectReason?.toLowerCase().includes(q)
    );
  }, [data?.rejected, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-8 w-64 bg-line rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-line rounded-2xl"></div>
          ))}
        </div>
        <div className="h-96 bg-line rounded-2xl"></div>
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink flex items-center gap-2">
            <CreditCard className="text-accent" size={24} />
            Payment Verifications &amp; UPI Settlements
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Verify customer UPI payments, review UTR submissions, approve tax invoice dispatches, and configure gateway VPA.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchPayments(true)}
            disabled={refreshing}
            className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Verifications */}
        <div
          onClick={() => setActiveTab('pending')}
          className={`card p-5 cursor-pointer transition-all ${
            stats.pendingCount > 0
              ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/70'
              : 'border-line bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Pending Verification
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-ink mt-3">
            {stats.pendingCount || 0} Orders
          </p>
          <p className="text-xs text-amber-700 font-semibold mt-1">
            Total {formatMoney(stats.pendingTotalAmount || 0)} awaiting review
          </p>
        </div>

        {/* Card 2: Total Verified Revenue */}
        <div
          onClick={() => setActiveTab('verified')}
          className="card p-5 cursor-pointer hover:border-green-300 bg-gradient-to-br from-white to-green-50/40 border-green-200/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Verified Revenue
            </span>
            <div className="p-2.5 rounded-xl bg-green-600 text-white shadow-xs">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-green-700 mt-3">
            {formatMoney(stats.verifiedTotalAmount || 0)}
          </p>
          <p className="text-xs text-ink-muted mt-1">
            {stats.verifiedCount || 0} paid &amp; invoice dispatched
          </p>
        </div>

        {/* Card 3: Merchant UPI Gateway */}
        <div
          onClick={() => setActiveTab('settings')}
          className="card p-5 cursor-pointer hover:border-accent-soft bg-gradient-to-br from-white to-accent-soft/30 border-accent/15"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Merchant UPI VPA
            </span>
            <div className="p-2.5 rounded-xl bg-accent text-white shadow-xs">
              <QrCode size={18} />
            </div>
          </div>
          <p className="text-base font-mono font-bold text-ink mt-3 truncate">
            {data?.merchantUpi?.merchantUpiId || 'trackify@icici'}
          </p>
          <p className="text-xs text-accent font-medium mt-1">
            {data?.merchantUpi?.autoApprovePayments ? 'Auto-Approve Enabled' : 'Manual Admin Verification'}
          </p>
        </div>

        {/* Card 4: Rejected Payments */}
        <div
          onClick={() => setActiveTab('rejected')}
          className="card p-5 cursor-pointer hover:border-rose-300 bg-gradient-to-br from-white to-rose-50/30 border-rose-200/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Failed / Rejected
            </span>
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-xs">
              <XCircle size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-rose-700 mt-3">
            {stats.rejectedCount || 0} Orders
          </p>
          <p className="text-xs text-rose-600 mt-1">
            Reinitiate payment emails sent
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper/50">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <Clock size={14} />
              Pending Queue ({data?.pending?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('verified')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'verified'
                  ? 'bg-green-600 text-white shadow-xs'
                  : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <CheckCircle2 size={14} />
              Approved History ({data?.verified?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <XCircle size={14} />
              Rejected ({data?.rejected?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <Settings size={14} />
              Gateway Settings
            </button>
          </div>

          {activeTab !== 'settings' && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search order, user, or UTR..."
                className="input pl-8 text-xs h-8.5 w-full"
              />
            </div>
          )}
        </div>

        {/* TAB 1: PENDING VERIFICATIONS QUEUE */}
        {activeTab === 'pending' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider font-semibold whitespace-nowrap">
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Submitted UTR / Ref</th>
                  <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4 text-right">Submitted At</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {pendingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      <ShieldCheck size={36} className="text-green-600 mx-auto mb-2 opacity-75" />
                      <p className="font-semibold text-ink">All caught up!</p>
                      <p className="text-xs text-ink-muted mt-0.5">No orders are currently waiting for payment verification.</p>
                    </td>
                  </tr>
                ) : (
                  pendingOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-accent whitespace-nowrap">
                        {o.orderNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink whitespace-nowrap">{o.user?.name || 'Customer'}</div>
                        <div className="text-[11px] text-ink-muted whitespace-nowrap">{o.user?.email || '—'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {o.upiRefNumber ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-ink bg-paper px-2 py-0.5 rounded border border-line">
                              {o.upiRefNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyUtr(o.upiRefNumber)}
                              className="p-1 rounded hover:bg-paper-hover text-ink-muted hover:text-ink transition-colors"
                              title="Copy UTR"
                            >
                              {copiedUtr === o.upiRefNumber ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink-muted italic">
                            (No UTR submitted)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-accent text-sm whitespace-nowrap">
                        {formatMoney(o.totalAmount)}
                      </td>

                      <td className="py-3.5 px-4 max-w-[180px] truncate text-ink">
                        {o.document?.originalName || 'Print Document'}
                      </td>

                      <td className="py-3.5 px-4 text-right text-ink-muted whitespace-nowrap">
                        {formatDateTime(o.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActionOrder(o);
                              setVerifyModalOpen(true);
                            }}
                            className="btn btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white shadow-xs"
                          >
                            <Check size={14} /> Verify &amp; Approve
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActionOrder(o);
                              setRejectReason('Payment not received in merchant UPI account');
                              setRejectModalOpen(true);
                            }}
                            className="btn btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1 text-rose-700 hover:bg-rose-50 border-rose-200"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: VERIFIED PAYMENTS HISTORY */}
        {activeTab === 'verified' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider font-semibold whitespace-nowrap">
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">UPI UTR / Ref</th>
                  <th className="py-3.5 px-4 text-right">Amount Paid</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Verified At</th>
                  <th className="py-3.5 px-4 text-center">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {verifiedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      No verified payments recorded.
                    </td>
                  </tr>
                ) : (
                  verifiedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-paper-hover/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-accent whitespace-nowrap">
                        {o.orderNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink whitespace-nowrap">{o.user?.name || 'Customer'}</div>
                        <div className="text-[11px] text-ink-muted whitespace-nowrap">{o.user?.email || '—'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-ink">
                        {o.upiRefNumber || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-green-700 whitespace-nowrap">
                        {formatMoney(o.totalAmount)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
                          <CheckCircle2 size={11} /> PAID
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right text-ink-muted whitespace-nowrap">
                        {o.verifiedAt ? formatDateTime(o.verifiedAt) : formatDateTime(o.updatedAt)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <a
                          href={invoiceUrl(o.id)}
                          download={`Invoice-${o.orderNumber}.pdf`}
                          className="p-1.5 rounded-lg hover:bg-paper-hover text-ink-muted hover:text-accent inline-flex items-center transition-colors"
                          title="Download Tax Invoice PDF"
                        >
                          <Download size={16} />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: REJECTED PAYMENTS */}
        {activeTab === 'rejected' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider font-semibold whitespace-nowrap">
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Rejection Reason</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-right">Rejected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {rejectedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-ink-muted">
                      No rejected payments.
                    </td>
                  </tr>
                ) : (
                  rejectedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-accent whitespace-nowrap">
                        {o.orderNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink whitespace-nowrap">{o.user?.name || 'Customer'}</div>
                        <div className="text-[11px] text-ink-muted whitespace-nowrap">{o.user?.email || '—'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-rose-700 font-medium max-w-sm">
                        {o.paymentRejectReason || 'Payment could not be verified in merchant account'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-ink whitespace-nowrap">
                        {formatMoney(o.totalAmount)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-ink-muted whitespace-nowrap">
                        {formatDateTime(o.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: GATEWAY & MERCHANT UPI SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-6 max-w-2xl">
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Merchant UPI Configuration
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Set the receiving UPI VPA ID and business name used for generating dynamic QR codes and deep links.
                </p>
              </div>

              <Field
                label="Merchant UPI VPA ID"
                name="merchantUpiId"
                value={settingsForm.merchantUpiId}
                onChange={(e) => setSettingsForm((f) => ({ ...f, merchantUpiId: e.target.value }))}
                required
                placeholder="e.g. trackify@icici or 9876543210@paytm"
                className="font-mono text-sm"
              />

              <Field
                label="Business / Merchant Display Name"
                name="merchantName"
                value={settingsForm.merchantName}
                onChange={(e) => setSettingsForm((f) => ({ ...f, merchantName: e.target.value }))}
                required
                placeholder="e.g. Inks by Trackify"
                className="text-sm"
              />

              <div className="p-4 rounded-xl border border-line bg-paper/60 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.autoApprovePayments}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, autoApprovePayments: e.target.checked }))}
                    className="rounded border-line text-accent focus:ring-accent-soft h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-ink block">
                      Auto-Approve Payments (Demo Mode)
                    </span>
                    <span className="text-[11px] text-ink-muted block mt-0.5">
                      When enabled, orders are instantly confirmed as PAID without requiring admin manual UTR verification. Keep disabled for real-world UPI verification.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-line flex justify-end">
                <Button type="submit" loading={savingSettings} className="btn-primary text-xs">
                  Save Gateway Settings
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* APPROVE PAYMENT CONFIRMATION MODAL */}
      <Modal
        open={verifyModalOpen}
        onClose={() => (processingAction ? null : setVerifyModalOpen(false))}
        title="Verify & Confirm Payment"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setVerifyModalOpen(false)}
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              loading={processingAction}
              loadingText="Verifying & emailing invoice..."
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check size={16} /> Confirm Paid &amp; Send Invoice
            </Button>
          </>
        }
      >
        {actionOrder && (
          <div className="space-y-4 text-xs">
            <p className="text-ink-soft">
              Are you sure you want to approve the payment for order <strong className="font-mono text-accent">{actionOrder.orderNumber}</strong>?
            </p>

            <div className="p-4 rounded-xl bg-paper border border-line space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-muted">Customer</span>
                <span className="font-semibold text-ink">{actionOrder.user?.name} ({actionOrder.user?.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Amount Received</span>
                <span className="font-bold text-green-700 text-sm">{formatMoney(actionOrder.totalAmount)}</span>
              </div>
              {actionOrder.upiRefNumber && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Submitted UTR</span>
                  <span className="font-mono font-bold text-ink">{actionOrder.upiRefNumber}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 space-y-1">
              <strong>Automatic Actions Triggered on Approval:</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Order status transitions to <strong>CONFIRMED / PAID</strong></li>
                <li>Official <strong>Tax Invoice PDF</strong> generated and emailed to {actionOrder.user?.email}</li>
                <li>Customer notified in-app that order is queued for printing</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* REJECT PAYMENT MODAL */}
      <Modal
        open={rejectModalOpen}
        onClose={() => (processingAction ? null : setRejectModalOpen(false))}
        title="Reject Payment & Request Reinitiation"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRejectModalOpen(false)}
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={processingAction}
              loadingText="Rejecting & emailing customer..."
            >
              <Send size={15} /> Send Reinitiate Email
            </Button>
          </>
        }
      >
        {actionOrder && (
          <div className="space-y-4 text-xs">
            <p className="text-ink-soft">
              This will mark order <strong className="font-mono text-accent">{actionOrder.orderNumber}</strong> as unverified and email customer <strong>{actionOrder.user?.email}</strong> with a direct link to reinitiate payment.
            </p>

            <div>
              <label className="block font-medium text-ink mb-1.5">
                Rejection Reason (will be sent in the email to customer)
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input text-xs w-full mb-2 bg-white"
              >
                <option value="Payment not received in merchant UPI account">Payment not received in merchant UPI account</option>
                <option value="Invalid UPI Reference / UTR Number">Invalid UPI Reference / UTR Number</option>
                <option value="Amount paid does not match order total">Amount paid does not match order total</option>
                <option value="Payment transaction was reversed or cancelled">Payment transaction was reversed or cancelled</option>
                <option value="Other">Other / Custom Reason</option>
              </select>

              {rejectReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Enter custom rejection reason..."
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="input text-xs w-full"
                />
              )}
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
              <strong>Customer Notification:</strong>
              <p>
                "[Action Required] Reinitiate Payment for Inks Order #{actionOrder.orderNumber}" with a one-click button to pay via UPI QR code or enter valid UTR.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
