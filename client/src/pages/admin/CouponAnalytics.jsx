import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { formatMoney, formatDateTime, formatDate } from '../../lib/format';
import { useToast } from '../../components/Toaster';
import CouponDetailModal from '../../components/admin/CouponDetailModal';
import {
  Tag,
  DollarSign,
  TrendingUp,
  Percent,
  Users,
  Package,
  ArrowUpRight,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  BarChart3,
  Calendar,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';

export default function CouponAnalytics({ onSelectCouponToEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [chartMetric, setChartMetric] = useState('revenue'); // 'revenue' | 'redemptions' | 'discount'
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);
  const toast = useToast();

  const fetchAnalytics = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await api.get('/coupons/analytics');
      setData(res);
      if (isRefresh) toast('Analytics refreshed', 'success');
    } catch (err) {
      toast(err.message || 'Failed to load coupon analytics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDetail = (couponId) => {
    setSelectedCouponId(couponId);
    setDetailModalOpen(true);
  };

  const exportCsv = () => {
    if (!data?.recentRedemptions || data.recentRedemptions.length === 0) {
      toast('No redemptions data to export', 'error');
      return;
    }

    const headers = ['Order Number', 'Coupon Code', 'Customer Name', 'Customer Email', 'Subtotal (INR)', 'Discount Amount (INR)', 'Final Paid (INR)', 'Redeemed At'];
    const rows = data.recentRedemptions.map((r) => [
      r.order?.orderNumber || r.orderId,
      r.coupon?.code || 'N/A',
      r.user?.name || 'N/A',
      r.user?.email || 'N/A',
      r.order?.subtotal || 0,
      r.discountAmount || 0,
      r.order?.totalAmount || 0,
      new Date(r.createdAt).toISOString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inks_Coupon_Redemptions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('CSV Export completed', 'success');
  };

  // Filter redemptions
  const filteredRedemptions = useMemo(() => {
    if (!data?.recentRedemptions) return [];
    if (!searchTerm.trim()) return data.recentRedemptions;
    const q = searchTerm.toLowerCase().trim();
    return data.recentRedemptions.filter(
      (r) =>
        r.coupon?.code?.toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        r.order?.orderNumber?.toLowerCase().includes(q)
    );
  }, [data?.recentRedemptions, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-8 w-64 bg-line rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-line rounded-2xl"></div>
          ))}
        </div>
        <div className="h-72 bg-line rounded-2xl"></div>
        <div className="h-64 bg-line rounded-2xl"></div>
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary;
  const topCoupons = data.topCoupons || [];
  const timeline = data.timeline || [];
  const typeDist = data.typeDistribution || {};

  // Find max for SVG chart scaling
  const maxMetricVal = Math.max(
    ...timeline.map((d) => (chartMetric === 'revenue' ? d.revenue : chartMetric === 'discount' ? d.discount : d.redemptions)),
    10
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-ink flex items-center gap-2">
            <Sparkles className="text-accent" size={20} />
            Coupon Analytics &amp; ROI Insights
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Real-time performance, customer discount spend, and revenue attribution.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
            title="Refresh analytics data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales Generated */}
        <div className="card p-5 bg-gradient-to-br from-white to-accent-soft/30 border-accent/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Sales Driven
            </span>
            <div className="p-2.5 rounded-xl bg-accent text-white shadow-xs">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-ink mt-3">
            {formatMoney(summary.totalRevenueFromCoupons)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-accent font-medium mt-1">
            <TrendingUp size={14} />
            <span>{summary.roiMultiplier}x ROI on discount spend</span>
          </div>
        </div>

        {/* Card 2: Total Discounts Given */}
        <div className="card p-5 bg-gradient-to-br from-white to-green-50/50 border-green-200/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Total Discounts Given
            </span>
            <div className="p-2.5 rounded-xl bg-green-600 text-white shadow-xs">
              <Percent size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-green-600 mt-3">
            {formatMoney(summary.totalDiscountGiven)}
          </p>
          <p className="text-xs text-ink-muted mt-1">
            Avg {formatMoney(summary.averageDiscount)} saved per order
          </p>
        </div>

        {/* Card 3: Total Redemptions */}
        <div className="card p-5 bg-gradient-to-br from-white to-blue-50/50 border-blue-200/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Total Redemptions
            </span>
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Package size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-ink mt-3">
            {summary.totalRedemptions}
          </p>
          <p className="text-xs text-ink-muted mt-1">
            Used in <strong className="text-ink">{summary.couponUsageOrderRate}%</strong> of all store orders
          </p>
        </div>

        {/* Card 4: Unique Customers */}
        <div className="card p-5 bg-gradient-to-br from-white to-purple-50/50 border-purple-200/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Customers Reached
            </span>
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-xs">
              <Users size={18} />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-purple-600 mt-3">
            {summary.uniqueUsersCount}
          </p>
          <p className="text-xs text-ink-muted mt-1">
            {summary.activeCoupons} active coupons currently live
          </p>
        </div>
      </div>

      {/* Interactive 30-Day Activity & Revenue Trend */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink flex items-center gap-2">
              <BarChart3 size={18} className="text-accent" />
              30-Day Redemption &amp; Revenue Velocity
            </h3>
            <p className="text-xs text-ink-muted">
              Hover over dates to inspect daily sales, discount disbursements, and usage counts.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center bg-paper p-1 rounded-xl border border-line self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                chartMetric === 'revenue'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Sales Generated
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('discount')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                chartMetric === 'discount'
                  ? 'bg-green-600 text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Discounts Given
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('redemptions')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                chartMetric === 'redemptions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Usage Count
            </button>
          </div>
        </div>

        {/* SVG Interactive Timeline Bar / Area Chart */}
        <div className="relative pt-6 pb-2">
          {/* Active Tooltip */}
          {hoveredDataPoint && (
            <div className="absolute top-0 right-4 bg-ink text-white text-xs px-3 py-1.5 rounded-lg shadow-pop flex items-center gap-3 animate-fade-in z-10">
              <span className="font-semibold">{hoveredDataPoint.label}:</span>
              <span>Orders: <strong>{hoveredDataPoint.redemptions}</strong></span>
              <span>Discount: <strong className="text-green-400">₹{hoveredDataPoint.discount.toFixed(2)}</strong></span>
              <span>Revenue: <strong className="text-accent-soft">₹{hoveredDataPoint.revenue.toFixed(2)}</strong></span>
            </div>
          )}

          <div className="h-56 flex items-end gap-1.5 sm:gap-2 px-2 border-b border-line">
            {timeline.map((d, idx) => {
              const val = chartMetric === 'revenue' ? d.revenue : chartMetric === 'discount' ? d.discount : d.redemptions;
              const heightPercent = maxMetricVal > 0 ? Math.max(8, Math.round((val / maxMetricVal) * 100)) : 8;
              const barColor =
                chartMetric === 'revenue'
                  ? val > 0 ? 'bg-accent hover:bg-accent/80' : 'bg-line/40'
                  : chartMetric === 'discount'
                  ? val > 0 ? 'bg-green-500 hover:bg-green-600' : 'bg-line/40'
                  : val > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-line/40';

              return (
                <div
                  key={d.date}
                  onMouseEnter={() => setHoveredDataPoint(d)}
                  onMouseLeave={() => setHoveredDataPoint(null)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                >
                  <div
                    className={`w-full rounded-t-md transition-all duration-200 ${barColor}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  {idx % 5 === 0 && (
                    <span className="text-[10px] text-ink-muted mt-2 truncate w-full text-center">
                      {d.label.split(' ')[0]} {d.label.split(' ')[1]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Leaderboard + Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Coupon Leaderboard */}
        <div className="lg:col-span-2 card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                <Award size={18} className="text-accent" />
                Coupon Leaderboard &amp; Usage
              </h3>
              <p className="text-xs text-ink-muted">
                Ranked by customer redemptions and gross sales generated. Click any coupon to view users.
              </p>
            </div>
            <span className="text-xs text-ink-muted font-medium">
              {topCoupons.length} Total Coupons
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-paper border-b border-line text-ink-muted font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Coupon Code</th>
                  <th className="py-2.5 px-3 text-center">Discount</th>
                  <th className="py-2.5 px-3 text-center">Redemptions</th>
                  <th className="py-2.5 px-3 text-right">Discounts Given</th>
                  <th className="py-2.5 px-3 text-right">Revenue Generated</th>
                  <th className="py-2.5 px-3 text-center">ROI</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {topCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ink-muted">
                      No coupons created yet.
                    </td>
                  </tr>
                ) : (
                  topCoupons.map((c, rank) => (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenDetail(c.id)}
                      className="hover:bg-accent-soft/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-5 w-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                            rank === 0 ? 'bg-amber-100 text-amber-800' :
                            rank === 1 ? 'bg-slate-200 text-slate-700' :
                            rank === 2 ? 'bg-amber-700/10 text-amber-900' : 'text-ink-muted'
                          }`}>
                            #{rank + 1}
                          </span>
                          <div>
                            <div className="font-mono font-bold text-accent group-hover:underline flex items-center gap-1.5">
                              {c.code}
                              <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {c.description && (
                              <p className="text-[11px] text-ink-muted truncate max-w-[140px]">
                                {c.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent/10 text-accent">
                          {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="font-bold text-ink">{c.totalRedemptions}</div>
                        <div className="text-[10px] text-ink-muted">
                          {c.uniqueUsersCount} users
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-green-600">
                        {formatMoney(c.totalDiscount)}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-ink">
                        {formatMoney(c.totalRevenue)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-paper border border-line text-ink">
                          {c.roi}x
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(c.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-paper-hover text-ink-muted hover:text-accent transition-colors"
                          title="View user details & orders"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Distribution & Status Breakdown */}
        <div className="space-y-6">
          {/* Card: Discount Type Distribution */}
          <div className="card p-5 space-y-3.5">
            <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Layers size={16} className="text-accent" />
              Discount Strategy Mix
            </h4>

            <div className="space-y-3 pt-1">
              {/* Percentage */}
              <div className="p-3 rounded-xl bg-paper/70 border border-line">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-ink">Percentage Coupons (%)</span>
                  <span className="text-accent font-bold">
                    {typeDist.PERCENT?.redemptions || 0} used
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-ink-muted">
                  <span>{typeDist.PERCENT?.count || 0} active codes</span>
                  <span>Sales: <strong>{formatMoney(typeDist.PERCENT?.revenue || 0)}</strong></span>
                </div>
              </div>

              {/* Fixed */}
              <div className="p-3 rounded-xl bg-paper/70 border border-line">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-ink">Flat Amount Coupons (₹)</span>
                  <span className="text-green-600 font-bold">
                    {typeDist.FIXED?.redemptions || 0} used
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-ink-muted">
                  <span>{typeDist.FIXED?.count || 0} active codes</span>
                  <span>Sales: <strong>{formatMoney(typeDist.FIXED?.revenue || 0)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Coupon Health Summary */}
          <div className="card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              Coupon Inventory Health
            </h4>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl border border-green-200 bg-green-50/50">
                <span className="text-[11px] font-semibold text-green-800 uppercase flex items-center gap-1">
                  <CheckCircle2 size={12} /> Active
                </span>
                <p className="text-xl font-bold text-green-700 mt-1">
                  {summary.activeCoupons}
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50">
                <span className="text-[11px] font-semibold text-amber-800 uppercase flex items-center gap-1">
                  <Clock size={12} /> Expired
                </span>
                <p className="text-xl font-bold text-amber-700 mt-1">
                  {summary.expiredCoupons}
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/50">
                <span className="text-[11px] font-semibold text-orange-800 uppercase flex items-center gap-1">
                  <AlertTriangle size={12} /> Limit Reached
                </span>
                <p className="text-xl font-bold text-orange-700 mt-1">
                  {summary.depletedCoupons}
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-gray-200 bg-gray-50">
                <span className="text-[11px] font-semibold text-gray-700 uppercase flex items-center gap-1">
                  <XCircle size={12} /> Disabled
                </span>
                <p className="text-xl font-bold text-gray-700 mt-1">
                  {summary.disabledCoupons}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Redemptions Audit Table */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">
              Recent Redemptions &amp; Orders Log
            </h3>
            <p className="text-xs text-ink-muted">
              Live audit stream of customer orders where promotional coupons were applied.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search code, user, or order..."
              className="input pl-9 text-xs h-9 w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-paper border-b border-line text-ink-muted font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Order #</th>
                <th className="py-2.5 px-3">Coupon Applied</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                <th className="py-2.5 px-3 text-right">Discount Saved</th>
                <th className="py-2.5 px-3 text-right">Final Amount</th>
                <th className="py-2.5 px-3 text-right">Redeemed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {filteredRedemptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    No matching redemptions found.
                  </td>
                </tr>
              ) : (
                filteredRedemptions.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleOpenDetail(r.couponId)}
                    className="hover:bg-paper-hover/60 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-accent">
                      {r.order?.orderNumber || `Order #${r.orderId}`}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/10 text-accent border border-accent/20">
                        {r.coupon?.code || 'COUPON'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-ink">{r.user?.name || 'User'}</div>
                      <div className="text-[11px] text-ink-muted">{r.user?.email || '—'}</div>
                    </td>

                    <td className="py-2.5 px-3 text-right text-ink">
                      {formatMoney(r.order?.subtotal || 0)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-semibold text-green-600">
                      - {formatMoney(r.discountAmount)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-bold text-ink">
                      {formatMoney(r.order?.totalAmount || 0)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-ink-muted whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drilldown Modal */}
      {selectedCouponId && (
        <CouponDetailModal
          couponId={selectedCouponId}
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedCouponId(null);
          }}
          onEdit={onSelectCouponToEdit}
        />
      )}
    </div>
  );
}
