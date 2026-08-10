import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import { EmptyState } from '../../components/States';
import Modal from '../../components/Modal';
import Field from '../../components/Field';
import Button from '../../components/Button';
import { formatDate } from '../../lib/format';
import { Tag, Plus, Edit2, Trash2 } from 'lucide-react';

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
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(INITIAL_COUPON);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
        toast('Coupon updated', 'success');
      } else {
        await api.post('/coupons', payload);
        toast('Coupon created', 'success');
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
    if (!window.confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) return;
    try {
      await api.del(`/coupons/${id}`);
      toast('Coupon deleted', 'success');
      fetchCoupons();
    } catch (err) {
      toast(err.message || 'Failed to delete coupon', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Coupons</h1>
          <p className="text-ink-muted mt-1">Manage discount codes and promotions.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary">
          <Plus size={18} /> New Coupon
        </button>
      </header>

      <div className="card overflow-hidden">
        {loading && coupons.length === 0 ? (
          <div className="p-12 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>
        ) : coupons.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No coupons yet"
            description="Create your first discount code to offer promotions."
            action={<button onClick={() => handleOpenModal()} className="btn btn-secondary">Create Coupon</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Discount</th>
                  <th className="px-6 py-4 font-medium">Usage</th>
                  <th className="px-6 py-4 font-medium">Limits</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-paper-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-ink">{c.code}</div>
                      {c.description && <div className="text-xs text-ink-muted mt-0.5">{c.description}</div>}
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">
                      {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `₹${c.discountValue.toFixed(2)}`}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-ink">{c.usedCount} used</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-muted space-y-0.5">
                      {c.usageLimit && <div>Max total: {c.usageLimit}</div>}
                      {c.perUserLimit && <div>Max/user: {c.perUserLimit}</div>}
                      {c.minOrderValue && <div>Min order: ₹{c.minOrderValue}</div>}
                      {c.maxDiscount && <div>Max disc: ₹{c.maxDiscount}</div>}
                      {!c.usageLimit && !c.perUserLimit && !c.minOrderValue && !c.maxDiscount && <div>No limits</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-max ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {c.expiresAt && (
                          <span className={`text-xs ${new Date(c.expiresAt) < new Date() ? 'text-red-500' : 'text-ink-muted'}`}>
                            Exp: {formatDate(c.expiresAt)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(c)}
                          className="p-2 text-ink-soft hover:text-ink hover:bg-paper-hover rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCoupon(c.id)}
                          className="p-2 text-danger/70 hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingCoupon ? "Edit Coupon" : "Create Coupon"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Coupon Code"
            name="code"
            value={form.code}
            onChange={set('code')}
            required
            placeholder="e.g. SUMMER20"
            className="uppercase"
          />
          <Field
            label="Description (Optional)"
            name="description"
            value={form.description}
            onChange={set('description')}
            placeholder="Internal note"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={set('discountType')}
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent-soft outline-none"
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
              label="Max Discount (₹)"
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
              className="rounded border-line text-accent focus:ring-accent-soft"
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
    </div>
  );
}
