import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import { EmptyState } from '../../components/States';
import Modal from '../../components/Modal';
import Field from '../../components/Field';
import Button from '../../components/Button';
import { formatDate, formatMoney } from '../../lib/format';
import CouponAnalytics from './CouponAnalytics';
import CouponDetailModal from '../../components/admin/CouponDetailModal';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  BarChart3,
  ListFilter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Percent,
  DollarSign
} from 'lucide-react';

const INITIAL_COUPON = {
  code: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  minOrderValue: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '',
  expiresAt: '',
  isActive: true
};

export default function Coupons() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'manage';

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [selectedCouponId, setSelectedCouponId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_COUPON);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const setTab = (tab) => {
    if (tab === 'analytics') {
      setSearchParams({ tab: 'analytics' });
    } else {
      setSearchParams({});
    }
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const data = await api.get('/coupons');
      setCoupons(data);
    } catch (err) {
      toast('Failed to load coupons', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setForm({
        ...coupon,
        discountValue: coupon.discountValue.toString(),
        minOrderValue: coupon.minOrderValue ? coupon.minOrderValue.toString() : '',
        maxDiscount: coupon.maxDiscount ? coupon.maxDiscount.toString() : '',
        usageLimit: coupon.usageLimit ? coupon.usageLimit.toString() : '',
        perUserLimit: coupon.perUserLimit ? coupon.perUserLimit.toString() : '',
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingCoupon(null);
      setForm(INITIAL_COUPON);
    }
    setModalOpen(true);
  };

  const handleViewDetail = (couponId) => {
    setSelectedCouponId(couponId);
    setDetailModalOpen(true);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // Parse form data back to proper types
    const payload = {
      ...form,
      discountValue: parseFloat(form.discountValue),
      minOrderValue: form.minOrderValue ? parseFloat(form.minOrderValue) : null,
      maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
      perUserLimit: form.perUserLimit ? parseInt(form.perUserLimit) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null
    };

    try {
      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon.id}`, payload);
        toast('Coupon updated successfully', 'success');
      } else {
        await api.post('/coupons', payload);
        toast('Coupon created successfully', 'success');
      }
      setModalOpen(false);
      fetchCoupons();
    } catch (err) {
      toast(err.message || 'Failed to save coupon', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteCoupon = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await api.del(`/coupons/${id}`);
      toast('Coupon deleted', 'success');
      fetchCoupons();
    } catch (err) {
      toast('Failed to delete coupon', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Coupons &amp; Promotions</h1>
          <p className="text-ink-muted mt-1 text-xs">
            Manage promotional discount codes, track real-time redemption analytics and user savings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center bg-paper p-1 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setTab('manage')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                currentTab === 'manage'
                  ? 'bg-white text-ink shadow-xs border border-line'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <ListFilter size={14} />
              Coupons List
            </button>
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                currentTab === 'analytics'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <BarChart3 size={14} />
              Analytics &amp; ROI
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="btn btn-primary text-xs inline-flex items-center gap-1.5"
          >
            <Plus size={16} /> Create Coupon
          </button>
        </div>
      </div>

      {/* Render Analytics View OR Management Table */}
      {currentTab === 'analytics' ? (
        <CouponAnalytics
          onSelectCouponToEdit={(coupon) => {
            setTab('manage');
            handleOpenModal(coupon);
          }}
        />
      ) : (
        <div className="card overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="h-6 bg-line rounded w-1/4 animate-pulse"></div>
              <div className="h-10 bg-line rounded animate-pulse"></div>
              <div className="h-10 bg-line rounded animate-pulse"></div>
            </div>
          ) : coupons.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No coupons yet"
              description="Create your first discount code to offer promotions."
              action={
                <button
                  type="button"
                  onClick={() => handleOpenModal()}
                  className="btn btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <Plus size={16} /> Create Coupon
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Coupon Code</th>
                    <th className="px-6 py-4 font-medium">Discount</th>
                    <th className="px-6 py-4 font-medium">Redemptions</th>
                    <th className="px-6 py-4 font-medium">Limits &amp; Rules</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {coupons.map((c) => {
                    const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                    const isDepleted = c.usageLimit && c.usedCount >= c.usageLimit;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleViewDetail(c.id)}
                        className="hover:bg-paper-hover/50 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="font-mono font-bold text-accent group-hover:underline flex items-center gap-1.5">
                            {c.code}
                          </div>
                          {c.description && (
                            <div className="text-xs text-ink-muted mt-0.5 max-w-xs truncate">
                              {c.description}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 font-medium text-ink">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent">
                            {c.discountType === 'PERCENT'
                              ? `${c.discountValue}% OFF`
                              : `₹${c.discountValue.toFixed(2)} OFF`}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-ink flex items-center gap-2">
                            <span>{c.usedCount} used</span>
                            <span className="text-xs text-ink-muted font-normal">
                              ({c._count?.redemptions || c.usedCount} orders)
                            </span>
                          </div>
                          {c.usageLimit && (
                            <div className="w-24 h-1.5 bg-line rounded-full overflow-hidden mt-1.5">
                              <div
                                className="h-full bg-accent rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100))}%`
                                }}
                              />
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs text-ink-muted space-y-0.5">
                          {c.usageLimit && <div>Limit: {c.usageLimit} total</div>}
                          {c.perUserLimit && <div>Per user: {c.perUserLimit}x</div>}
                          {c.minOrderValue && <div>Min order: ₹{c.minOrderValue}</div>}
                          {c.maxDiscount && <div>Max cap: ₹{c.maxDiscount}</div>}
                          {!c.usageLimit && !c.perUserLimit && !c.minOrderValue && !c.maxDiscount && (
                            <span className="text-ink-muted">No restrictions</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {!c.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 w-max">
                                <XCircle size={12} /> Inactive
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 w-max">
                                <Clock size={12} /> Expired
                              </span>
                            ) : isDepleted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 w-max">
                                <AlertTriangle size={12} /> Depleted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 w-max">
                                <CheckCircle2 size={12} /> Active
                              </span>
                            )}
                            {c.expiresAt && (
                              <span className="text-xs text-ink-muted">
                                Exp: {formatDate(c.expiresAt)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewDetail(c.id)}
                              className="p-2 text-ink-soft hover:text-accent hover:bg-paper-hover rounded-lg transition-colors"
                              title="View user details and redemptions"
                            >
                              <Eye size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenModal(c)}
                              className="p-2 text-ink-soft hover:text-ink hover:bg-paper-hover rounded-lg transition-colors"
                              title="Edit coupon"
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCoupon(c.id)}
                              className="p-2 text-danger/70 hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                              title="Delete coupon"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Coupon Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Coupon Code"
            name="code"
            value={form.code}
            onChange={set('code')}
            required
            placeholder="e.g. SUMMER20"
            className="uppercase font-mono"
          />
          <Field
            label="Description (Optional)"
            name="description"
            value={form.description}
            onChange={set('description')}
            placeholder="e.g. Welcome promo for students"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={set('discountType')}
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent-soft outline-none bg-white text-sm"
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>
            <Field
              label="Discount Value"
              name="discountValue"
              type="number"
              step="0.01"
              required
              value={form.discountValue}
              onChange={set('discountValue')}
              placeholder={form.discountType === 'PERCENT' ? 'e.g. 20' : 'e.g. 100'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Min Order Value (₹)"
              name="minOrderValue"
              type="number"
              step="0.01"
              optional
              value={form.minOrderValue}
              onChange={set('minOrderValue')}
              placeholder="e.g. 500"
            />
            <Field
              label="Max Discount Cap (₹)"
              name="maxDiscount"
              type="number"
              step="0.01"
              optional
              value={form.maxDiscount}
              onChange={set('maxDiscount')}
              placeholder={form.discountType === 'PERCENT' ? 'e.g. 200' : 'N/A'}
              disabled={form.discountType === 'FIXED'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Total Usage Limit"
              name="usageLimit"
              type="number"
              optional
              value={form.usageLimit}
              onChange={set('usageLimit')}
              placeholder="e.g. 100"
            />
            <Field
              label="Per User Limit"
              name="perUserLimit"
              type="number"
              optional
              value={form.perUserLimit}
              onChange={set('perUserLimit')}
              placeholder="e.g. 1"
            />
          </div>

          <Field
            label="Expiration Date"
            name="expiresAt"
            type="datetime-local"
            optional
            value={form.expiresAt}
            onChange={set('expiresAt')}
          />

          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={set('isActive')}
              className="rounded border-line text-accent focus:ring-accent-soft h-4 w-4"
            />
            <span className="text-sm font-medium text-ink">Coupon is Active</span>
          </label>

          <div className="pt-4 flex justify-end gap-3 border-t border-line mt-6">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingCoupon ? 'Save Changes' : 'Create Coupon'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Individual Coupon Drilldown Modal */}
      {selectedCouponId && (
        <CouponDetailModal
          couponId={selectedCouponId}
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedCouponId(null);
          }}
          onEdit={(coupon) => {
            handleOpenModal(coupon);
          }}
        />
      )}
    </div>
  );
}
