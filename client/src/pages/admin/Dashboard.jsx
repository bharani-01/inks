import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import { Users, FileText, Package, DollarSign, Printer, Activity } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.get('/orders/admin/stats');
        setStats(data);
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
    </div>
  );
}
