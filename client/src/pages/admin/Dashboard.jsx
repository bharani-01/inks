import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Package,
  Printer,
  Users,
  FileText,
  Activity,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api, exportAnalyticsUrl } from '../../lib/api.js';
import { useToast } from '../../components/Toaster.jsx';
import Button from '../../components/Button.jsx';

function StatCard({ title, value, sub, icon: Icon, colorClass }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-2xl ${colorClass} shrink-0`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</p>
        <p className="text-2xl font-display font-bold text-ink mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-ink-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const [range, setRange] = useState('30d');
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState([]);
  const [totalRev, setTotalRev] = useState(0);
  const [trend, setTrend] = useState(0);

  const [heatmap, setHeatmap] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [topDocs, setTopDocs] = useState([]);
  const [couponRoi, setCouponRoi] = useState([]);
  const [consumption, setConsumption] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [range, period]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const [revRes, heatRes, funRes, docsRes, roiRes, consRes] = await Promise.all([
        api.get(`/analytics/revenue?range=${range}&period=${period}`),
        api.get(`/analytics/orders-heatmap?range=${range}`),
        api.get('/analytics/user-funnel'),
        api.get('/analytics/top-documents?limit=8'),
        api.get('/analytics/coupon-roi'),
        api.get(`/analytics/consumption?range=${range}`),
      ]);

      setRevenueData(revRes.data || []);
      setTotalRev(revRes.totalRevenue || 0);
      setTrend(revRes.trend || 0);

      setHeatmap(heatRes.heatmap || []);
      setFunnel(funRes.funnel || []);
      setTopDocs(docsRes.topDocuments || []);
      setCouponRoi(roiRes.couponRoi || []);
      setConsumption(consRes || null);
    } catch (err) {
      toast('Failed to load analytics dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleExport(report) {
    const url = exportAnalyticsUrl(report, range);
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header with Range Filter & Export toolbar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink flex items-center gap-2">
            <BarChart3 size={24} className="text-accent" /> Analytics &amp; Revenue Intelligence
          </h1>
          <p className="text-xs text-ink-muted mt-1">Real-time revenue trends, order heatmaps, and consumption forecasting.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range selector */}
          <div className="flex items-center bg-paper-sunken border border-line rounded-xl p-1 text-xs">
            {['7d', '30d', '90d', '1y'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  range === r ? 'bg-white text-accent shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <Button variant="secondary" size="sm" onClick={() => handleExport('revenue')}>
            <Download size={14} /> Revenue CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('orders')}>
            <Download size={14} /> Orders CSV
          </Button>
        </div>
      </header>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Period Revenue"
          value={`₹${totalRev.toFixed(2)}`}
          sub={trend > 0 ? `+₹${trend}/day momentum` : 'Stable volume'}
          icon={DollarSign}
          colorClass="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="Total Pages Printed"
          value={consumption?.totalPages || 0}
          sub={`${consumption?.totalBW || 0} B&W · ${consumption?.totalColor || 0} Color`}
          icon={Printer}
          colorClass="bg-indigo-100 text-indigo-700"
        />
        <StatCard
          title="Avg Daily Consumption"
          value={`${consumption?.avgDaily || 0} pgs`}
          sub="7-day projected demand"
          icon={Activity}
          colorClass="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="Repeat Customer Ratio"
          value={`${funnel.find((f) => f.stage.includes('Repeat'))?.percent || 0}%`}
          sub="Users with 2+ orders"
          icon={Users}
          colorClass="bg-purple-100 text-purple-700"
        />
      </div>

      {/* Main Revenue Time-Series Chart */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <h3 className="font-display font-semibold text-ink text-base">Revenue Growth &amp; Order Volume</h3>
            <p className="text-xs text-ink-muted">Historical revenue chart over selected period</p>
          </div>
          <div className="flex items-center gap-1.5 bg-paper-sunken border border-line rounded-xl p-1 text-xs">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                  period === p ? 'bg-accent text-white shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {revenueData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-ink-muted">No revenue data for this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="₹" />
                <Tooltip
                  formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', borderColor: '#cbd5e1', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: User Funnel & Top Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Acquisition Funnel */}
        <div className="card p-6 space-y-4">
          <h3 className="font-display font-semibold text-ink text-base">User Conversion Funnel</h3>
          <p className="text-xs text-ink-muted">Conversion from account registration to repeat print orders</p>

          <div className="space-y-3 pt-2">
            {funnel.map((item, idx) => (
              <div key={item.stage} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-ink">{item.stage}</span>
                  <span className="text-ink-muted">{item.count} users ({item.percent}%)</span>
                </div>
                <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.max(5, item.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coupon ROI Chart */}
        <div className="card p-6 space-y-4">
          <h3 className="font-display font-semibold text-ink text-base">Coupon Campaign ROI</h3>
          <p className="text-xs text-ink-muted">Discount given vs revenue generated per coupon code</p>

          <div className="h-56 w-full pt-2">
            {couponRoi.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-ink-muted">No coupon redemption data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={couponRoi} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="₹" />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="totalRevenue" name="Revenue Generated" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="totalDiscount" name="Discount Given" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Documents Table */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-ink text-base">Top Printed Documents</h3>
          <span className="text-xs text-ink-muted">Ranked by order frequency</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-paper-sunken border-b border-line text-ink-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Document Name</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topDocs.map((doc) => (
                <tr key={doc.documentId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-ink truncate max-w-xs">{doc.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{doc.orderCount} orders</td>
                  <td className="px-4 py-3 font-bold text-accent">₹{doc.totalRevenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
