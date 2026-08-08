/**
 * Printa — Admin Dashboard Analytics & KPI Logic
 */
document.addEventListener('DOMContentLoaded', async () => {
  renderKPIIcons();
  await loadDashboardStats();
});

function renderKPIIcons() {
  const setIcon = (id, svg) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  };

  setIcon('kpi-icon-revenue', icons.dollarSign);
  setIcon('kpi-icon-orders', icons.package);
  setIcon('kpi-icon-active', icons.zap);
  setIcon('kpi-icon-users', icons.users);
  setIcon('kpi-icon-pages', icons.layers);
  setIcon('kpi-icon-aov', icons.trendingUp);
  setIcon('kpi-icon-docs', icons.fileText);
  setIcon('kpi-icon-rate', icons.checkCircle);
}

async function loadDashboardStats() {
  try {
    const data = await api.get('/orders/stats');
    
    const {
      totalOrders = 0,
      received = 0,
      processing = 0,
      printed = 0,
      delivered = 0,
      cancelled = 0,
      totalRevenue = 0,
      avgOrderValue = 0,
      totalUsers = 0,
      totalDocuments = 0,
      totalPagesPrinted = 0,
      colorCount = 0,
      bwCount = 0,
      recentOrders = [],
    } = data;

    // ── Primary KPI Cards ───────────────
    setText('kpi-revenue', `₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    setText('kpi-total-orders', totalOrders);
    
    const activeCount = received + processing;
    setText('kpi-active-orders', activeCount);
    setText('kpi-active-subtext', `${received} Received • ${processing} Printing`);
    
    setText('kpi-total-users', totalUsers);

    // ── Secondary KPI Cards ─────────────
    setText('kpi-pages-printed', totalPagesPrinted.toLocaleString('en-IN'));
    setText('kpi-aov', `₹${avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    setText('kpi-total-docs', totalDocuments);

    const completedCount = printed + delivered;
    const fulfillmentRate = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0;
    setText('kpi-fulfillment-rate', `${fulfillmentRate}%`);

    // ── Pipeline Bar Breakdown ──────────
    setText('cnt-received', received);
    setText('cnt-processing', processing);
    setText('cnt-printed', printed);
    setText('cnt-delivered', delivered);
    setText('cnt-cancelled', cancelled);

    const safeTotal = totalOrders || 1;
    setBarWidth('seg-received', (received / safeTotal) * 100);
    setBarWidth('seg-processing', (processing / safeTotal) * 100);
    setBarWidth('seg-printed', (printed / safeTotal) * 100);
    setBarWidth('seg-delivered', (delivered / safeTotal) * 100);
    setBarWidth('seg-cancelled', (cancelled / safeTotal) * 100);

    // ── Color vs B&W Split ──────────────
    setText('cnt-color', colorCount);
    setText('cnt-bw', bwCount);

    const colorTotal = (colorCount + bwCount) || 1;
    const colorPct = Math.round((colorCount / colorTotal) * 100);
    const bwPct = 100 - colorPct;

    setText('pct-color', `${colorPct}%`);
    setText('pct-bw', `${bwPct}%`);
    setBarWidth('bar-color', colorPct);
    setBarWidth('bar-bw', bwPct);

    // ── Recent Orders Table ─────────────
    renderRecentOrders(recentOrders);

  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recent-orders-tbody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No orders recorded in system yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td><strong>${order.orderNumber}</strong></td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(order.user ? order.user.name : 'User')}</div>
        <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(order.user ? order.user.email : '')}</div>
      </td>
      <td>
        <div style="font-size: 0.8125rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(order.document ? order.document.originalName : 'Document')}
        </div>
      </td>
      <td><strong>₹${order.totalAmount.toFixed(2)}</strong></td>
      <td><span class="badge ${getStatusBadgeClass(order.orderStatus)}">${formatStatus(order.orderStatus)}</span></td>
      <td>${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
    </tr>
  `).join('');
}

function formatStatus(status) {
  switch (status) {
    case 'RECEIVED': return 'Received';
    case 'PROCESSING': return 'Processing';
    case 'PRINTED': return 'Printed';
    case 'DELIVERED': return 'Delivered';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'RECEIVED': return 'badge-neutral';
    case 'PROCESSING': return 'badge-accent';
    case 'PRINTED': return 'badge-success';
    case 'DELIVERED': return 'badge-success';
    case 'CANCELLED': return 'badge-error';
    default: return 'badge-neutral';
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBarWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
