import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../Modal';
import { formatMoney, formatDateTime, formatDate } from '../../lib/format';
import { useToast } from '../Toaster';
import {
  Tag,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Copy,
  Check,
  Package,
  Percent,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  X
} from 'lucide-react';

export default function CouponDetailModal({ couponId, open, onClose, onEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'customers'
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open || !couponId) {
      setData(null);
      return;
    }

    let isMounted = true;
    async function loadDetails() {
      try {
        setLoading(true);
        const res = await api.get(`/coupons/${couponId}/details`);
        if (isMounted) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          toast(err.message || 'Failed to load coupon details', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [couponId, open]);

  const handleCopyCode = () => {
    if (!data?.coupon?.code) return;
    navigator.clipboard.writeText(data.coupon.code);
    setCopied(true);
    toast(`Coupon code ${data.coupon.code} copied!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const coupon = data?.coupon;
  const stats = data?.stats;
  const redemptions = data?.redemptions || [];
  const usersSummary = data?.usersSummary || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={null}
      size="xl"
    >
      {loading ? (
        <div className="p-8 space-y-6 animate-pulse">
          <div className="h-10 bg-line rounded-lg w-1/3"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-line rounded-xl"></div>
            ))}
          </div>
          <div className="h-48 bg-line rounded-xl"></div>
        </div>
      ) : !coupon ? (
        <div className="p-8 text-center text-ink-muted">
          <p>Coupon details not found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="relative p-5 rounded-2xl bg-gradient-to-r from-accent-soft/60 via-paper to-white border border-accent/15">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-accent text-white shadow-sm mt-0.5 shrink-0">
                  <Tag size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl font-bold font-mono tracking-wider text-ink whitespace-nowrap">
                      {coupon.code}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1 rounded-lg hover:bg-paper-hover text-ink-muted hover:text-ink transition-colors"
                      title="Copy code"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20 whitespace-nowrap">
                      {coupon.discountType === 'PERCENT'
                        ? `${coupon.discountValue}% OFF`
                        : `₹${coupon.discountValue} OFF`}
                    </span>
                    <StatusBadge status={coupon.statusLabel} />
                  </div>
                  {coupon.description && (
                    <p className="text-xs text-ink-muted mt-1 max-w-xl">{coupon.description}</p>
                  )}
                  <div className="flex items-center gap-3.5 text-xs text-ink-muted mt-2 flex-wrap">
                    {coupon.minOrderValue && (
                      <span className="whitespace-nowrap">Min Order: <strong className="text-ink">₹{coupon.minOrderValue}</strong></span>
                    )}
                    {coupon.maxDiscount && (
                      <span className="whitespace-nowrap">Max Cap: <strong className="text-ink">₹{coupon.maxDiscount}</strong></span>
                    )}
                    {coupon.perUserLimit && (
                      <span className="whitespace-nowrap">Per User: <strong className="text-ink">{coupon.perUserLimit}x</strong></span>
                    )}
                    {coupon.expiresAt && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar size={13} />
                        Expires: <strong className="text-ink">{formatDate(coupon.expiresAt)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(coupon);
                  }}
                  className="btn btn-secondary text-xs shrink-0 self-start sm:self-center"
                >
                  Edit Settings
                </button>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Redemptions */}
            <div className="p-4 rounded-xl border border-line bg-white shadow-xs">
              <div className="flex items-center justify-between text-ink-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Redemptions</span>
                <Package size={16} className="text-accent" />
              </div>
              <p className="text-2xl font-display font-bold text-ink">
                {stats.totalRedemptions}
              </p>
              <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                {coupon.usageLimit ? `${coupon.usedCount} of ${coupon.usageLimit} limit` : 'No usage cap'}
              </p>
            </div>

            {/* Discounts Given */}
            <div className="p-4 rounded-xl border border-line bg-white shadow-xs">
              <div className="flex items-center justify-between text-ink-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Discounts Given</span>
                <Percent size={16} className="text-green-600" />
              </div>
              <p className="text-2xl font-display font-bold text-green-600 truncate">
                {formatMoney(stats.totalDiscountDisbursed)}
              </p>
              <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                Avg {formatMoney(stats.averageDiscount)} / order
              </p>
            </div>

            {/* Sales Driven */}
            <div className="p-4 rounded-xl border border-line bg-white shadow-xs">
              <div className="flex items-center justify-between text-ink-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Sales Driven</span>
                <DollarSign size={16} className="text-blue-600" />
              </div>
              <p className="text-2xl font-display font-bold text-ink truncate">
                {formatMoney(stats.totalRevenueGenerated)}
              </p>
              <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                {stats.roi > 0 ? `${stats.roi}x ROI on discount` : 'Gross revenue'}
              </p>
            </div>

            {/* Customers */}
            <div className="p-4 rounded-xl border border-line bg-white shadow-xs">
              <div className="flex items-center justify-between text-ink-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Customers</span>
                <Users size={16} className="text-purple-600" />
              </div>
              <p className="text-2xl font-display font-bold text-purple-600">
                {stats.uniqueCustomersCount}
              </p>
              <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                Distinct users redeemed
              </p>
            </div>
          </div>

          {/* Usage Limit Progress (if limit specified) */}
          {coupon.usageLimit && (
            <div className="p-4 rounded-xl border border-line bg-paper/60">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-ink">Usage Capacity</span>
                <span className="text-ink-muted">
                  <strong>{coupon.usedCount}</strong> / {coupon.usageLimit} ({stats.usageProgress}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.usageProgress >= 100
                      ? 'bg-danger'
                      : stats.usageProgress > 75
                      ? 'bg-amber-500'
                      : 'bg-accent'
                  }`}
                  style={{ width: `${stats.usageProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabs: Orders / Customers */}
          <div>
            <div className="flex items-center gap-2 border-b border-line pb-2 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-ink-muted hover:bg-paper-hover hover:text-ink'
                }`}
              >
                <Package size={14} /> Redemptions &amp; Orders ({redemptions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'customers'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-ink-muted hover:bg-paper-hover hover:text-ink'
                }`}
              >
                <Users size={14} /> Customer Breakdown ({usersSummary.length})
              </button>
            </div>

            {/* TAB 1: Individual Orders */}
            {activeTab === 'orders' && (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-paper border-b border-line text-ink-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-right">Order Subtotal</th>
                      <th className="py-3 px-4 text-right">Discount Saved</th>
                      <th className="py-3 px-4 text-right">Final Paid</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Redeemed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-white">
                    {redemptions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-ink-muted">
                          No customer has redeemed this coupon code yet.
                        </td>
                      </tr>
                    ) : (
                      redemptions.map((r) => (
                        <tr key={r.id} className="hover:bg-paper-hover/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-accent whitespace-nowrap">
                            {r.order?.orderNumber || `Order #${r.orderId}`}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-ink whitespace-nowrap">{r.user?.name || 'User'}</div>
                            <div className="text-[11px] text-ink-muted whitespace-nowrap">{r.user?.email || '—'}</div>
                          </td>
                          <td className="py-3 px-4 text-right text-ink font-medium whitespace-nowrap">
                            {formatMoney(r.order?.subtotal || 0)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600 whitespace-nowrap">
                            - {formatMoney(r.discountAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-ink whitespace-nowrap">
                            {formatMoney(r.order?.totalAmount || 0)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                              {r.order?.orderStatus || 'PAID'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-ink-muted whitespace-nowrap">
                            {formatDateTime(r.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Customer Aggregation */}
            {activeTab === 'customers' && (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-paper border-b border-line text-ink-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-center">Times Used</th>
                      <th className="py-3 px-4 text-right">Total Discount Received</th>
                      <th className="py-3 px-4 text-right">Total Spent</th>
                      <th className="py-3 px-4 text-right">First Used</th>
                      <th className="py-3 px-4 text-right">Last Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-white">
                    {usersSummary.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-ink-muted">
                          No customer data available.
                        </td>
                      </tr>
                    ) : (
                      usersSummary.map((item) => (
                        <tr key={item.user.id} className="hover:bg-paper-hover/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-ink whitespace-nowrap">{item.user.name}</div>
                            <div className="text-[11px] text-ink-muted whitespace-nowrap">{item.user.email}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-accent whitespace-nowrap">
                            <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full bg-accent/10">
                              {item.redemptionsCount}x
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600 whitespace-nowrap">
                            {formatMoney(item.totalDiscount)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-ink whitespace-nowrap">
                            {formatMoney(item.totalSpent)}
                          </td>
                          <td className="py-3 px-4 text-right text-ink-muted whitespace-nowrap">
                            {formatDate(item.firstRedeemedAt)}
                          </td>
                          <td className="py-3 px-4 text-right text-ink-muted whitespace-nowrap">
                            {formatDate(item.lastRedeemedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1 whitespace-nowrap">
          <CheckCircle2 size={12} /> Active
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1 whitespace-nowrap">
          <Clock size={12} /> Expired
        </span>
      );
    case 'DEPLETED':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1 whitespace-nowrap">
          <AlertTriangle size={12} /> Limit Reached
        </span>
      );
    case 'DISABLED':
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center gap-1 whitespace-nowrap">
          <XCircle size={12} /> Inactive
        </span>
      );
  }
}
