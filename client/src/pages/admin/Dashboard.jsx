import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import { Users, FileText, Package, DollarSign, Printer, Activity, Star, MessageSquare } from 'lucide-react';

function StatCard({ title, value, icon: Icon, colorClass }) {
  return (
    <div className="card p-6 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-muted">{title}</p>
        <p className="text-2xl font-display font-semibold text-ink mt-1">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function loadStats() {
      try {
        const [data, fbData] = await Promise.all([
          api.get('/orders/admin/stats'),
          api.get('/feedback?limit=8').catch(() => ({ feedback: [] })),
        ]);
        setStats(data);
        setFeedback(fbData.feedback || []);
      } catch (err) {
        toast('Failed to load dashboard stats', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [toast]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-line rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-line rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-2xl font-display font-bold text-ink">Dashboard Overview</h1>
        <p className="text-ink-muted mt-1">System statistics and recent activity.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue?.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          colorClass="bg-green-100 text-green-700"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={Package}
          colorClass="bg-blue-100 text-blue-700"
        />
        <StatCard
          title="Pages Printed"
          value={stats.totalPagesPrinted}
          icon={Printer}
          colorClass="bg-accent-soft text-accent"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          colorClass="bg-purple-100 text-purple-700"
        />
        <StatCard
          title="Documents Uploaded"
          value={stats.totalDocuments}
          icon={FileText}
          colorClass="bg-orange-100 text-orange-700"
        />
        <StatCard
          title="Avg Order Value"
          value={`₹${stats.avgOrderValue?.toFixed(2) || '0.00'}`}
          icon={Activity}
          colorClass="bg-teal-100 text-teal-700"
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold font-display text-ink mb-4">Recent Orders</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Order</th>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Document</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.recentOrders?.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-ink-muted">
                      No recent orders.
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders?.map((order) => (
                    <tr key={order.id} className="hover:bg-paper-hover/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{order.orderNumber}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-ink">{order.user.name}</div>
                        <div className="text-xs text-ink-muted">{order.user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-ink truncate max-w-[200px]" title={order.document.originalName}>
                        {order.document.originalName}
                      </td>
                      <td className="px-6 py-4 font-medium text-ink">₹{order.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-hover text-ink-soft border border-line">
                          {order.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Customer Feedback Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-display text-ink flex items-center gap-2">
            <MessageSquare size={20} className="text-accent" />
            Customer Feedback
          </h2>
          {feedback.length > 0 && (
            <span className="text-xs text-ink-muted">{feedback.length} recent submissions</span>
          )}
        </div>
        {feedback.length === 0 ? (
          <div className="card p-8 text-center text-ink-muted text-sm">
            No customer feedback yet. Feedback arrives after orders are delivered and customers scan their QR code.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedback.map((fb) => (
              <div key={fb.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {fb.order?.user?.name || 'Anonymous'}
                    </p>
                    <p className="text-xs text-ink-muted">{fb.order?.orderNumber}</p>
                  </div>
                  {fb.rating && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1,2,3,4,5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-line fill-line'}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {fb.message && (
                  <p className="text-xs text-ink-soft bg-paper-sunken rounded-lg px-3 py-2">
                    {fb.message}
                  </p>
                )}
                {fb.featureSuggestion && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="font-semibold">Suggestion: </span>{fb.featureSuggestion}
                  </div>
                )}
                <p className="text-[10px] text-ink-muted">
                  {new Date(fb.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
