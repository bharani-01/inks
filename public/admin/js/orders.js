/**
 * Printa — Admin Orders Dashboard Logic
 */
let currentPage = 1;
let currentSearch = '';
let currentStatusFilter = '';
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadAdminOrderStats();
  await loadAdminOrders();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1;
        loadAdminOrders();
      }, 300);
    });
  }

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      currentPage = 1;
      loadAdminOrders();
    });
  }

  const modal = document.getElementById('admin-order-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAdminOrderModal();
    });
  }
});

async function loadAdminOrderStats() {
  try {
    const data = await api.get('/orders/admin/stats');
    document.getElementById('stat-total-orders').textContent = data.totalOrders;
    document.getElementById('stat-received').textContent = data.received;
    document.getElementById('stat-processing').textContent = data.processing;
    document.getElementById('stat-revenue').textContent = `₹${data.totalRevenue.toFixed(2)}`;
  } catch (err) {
    console.error('Failed to load order stats:', err);
  }
}

async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  const emptyState = document.getElementById('empty-state');
  if (!tbody) return;

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 10,
      search: currentSearch,
      status: currentStatusFilter,
    });

    const data = await api.get(`/orders/admin/all?${params}`);
    const { orders, pagination } = data;

    if (orders.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      document.getElementById('pagination-info').textContent = '0 orders';
      document.getElementById('pagination-controls').innerHTML = '';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = orders.map(order => `
      <tr>
        <td><strong>${order.orderNumber}</strong></td>
        <td>
          <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(order.user ? order.user.name : 'User')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(order.user ? order.user.email : '')}</div>
        </td>
        <td>
          <div style="font-weight: 500; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(order.document ? order.document.originalName : 'Document')}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${order.colorMode} • ${order.copies} copy • ${order.paperSize}</div>
        </td>
        <td><strong>₹${order.totalAmount.toFixed(2)}</strong></td>
        <td>
          <select class="form-select" onchange="handleOrderStatusChange(${order.id}, this.value)" style="font-size: 0.75rem; height: 30px;">
            <option value="RECEIVED" ${order.orderStatus === 'RECEIVED' ? 'selected' : ''}>Received</option>
            <option value="PROCESSING" ${order.orderStatus === 'PROCESSING' ? 'selected' : ''}>Processing</option>
            <option value="PRINTED" ${order.orderStatus === 'PRINTED' ? 'selected' : ''}>Printed</option>
            <option value="DELIVERED" ${order.orderStatus === 'DELIVERED' ? 'selected' : ''}>Delivered</option>
            <option value="CANCELLED" ${order.orderStatus === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
        <td>
          <div class="actions">
            ${order.document ? `<a href="/api/documents/${order.document.id}/preview?download=true&token=${encodeURIComponent(api.getToken())}" target="_blank" download="${escapeHtml(order.document.originalName)}" class="btn btn-secondary btn-sm" title="Download Document">${icons.download} File</a>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="viewAdminOrderDetail(${order.id})" title="View Full Order Specs">${icons.eye}</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(pagination);
  } catch (err) {
    showToast('Failed to load orders', 'error');
  }
}

async function handleOrderStatusChange(orderId, newStatus) {
  try {
    const data = await api.put(`/orders/admin/${orderId}/status`, { orderStatus: newStatus });
    showToast(data.message || 'Order status updated', 'success');
    await loadAdminOrderStats();
    await loadAdminOrders();
  } catch (err) {
    showToast(err.message || 'Failed to update status', 'error');
    await loadAdminOrders();
  }
}

function renderPagination(pagination) {
  const { page, total, totalPages } = pagination;
  const infoEl = document.getElementById('pagination-info');
  const controlsEl = document.getElementById('pagination-controls');

  if (infoEl) {
    const start = (page - 1) * 10 + 1;
    const end = Math.min(page * 10, total);
    infoEl.textContent = `Showing ${start}–${end} of ${total}`;
  }

  if (controlsEl) {
    let html = `<button class="pagination-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>${icons.chevronLeft}</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>${icons.chevronRight}</button>`;
    controlsEl.innerHTML = html;
  }
}

function goToPage(page) {
  currentPage = page;
  loadAdminOrders();
}

async function viewAdminOrderDetail(id) {
  const modal = document.getElementById('admin-order-modal');
  const content = document.getElementById('admin-order-content');
  if (!modal || !content) return;

  try {
    const data = await api.get(`/orders/${id}`);
    const order = data.order;

    content.innerHTML = `
      <div style="font-size: 0.875rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 1.125rem;">Order: ${order.orderNumber}</div>
            <div class="text-muted">Customer: ${escapeHtml(order.user ? order.user.name : '')} (${escapeHtml(order.user ? order.user.email : '')})</div>
          </div>
          <div>
            ${order.document ? `<a href="/api/documents/${order.document.id}/preview?download=true&token=${encodeURIComponent(api.getToken())}" target="_blank" download="${escapeHtml(order.document.originalName)}" class="btn btn-primary btn-sm">${icons.download} Download Document</a>` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: var(--bg-hover); padding: 14px; border-radius: var(--radius-md);">
          <div><span class="text-muted">Color Mode:</span> <strong>${order.colorMode}</strong></div>
          <div><span class="text-muted">Paper Size:</span> <strong>${order.paperSize}</strong></div>
          <div><span class="text-muted">Sides (Duplex):</span> <strong>${order.sides}</strong></div>
          <div><span class="text-muted">Copies:</span> <strong>${order.copies}</strong></div>
          <div><span class="text-muted">Binding:</span> <strong style="text-transform: capitalize;">${order.binding}</strong></div>
          <div><span class="text-muted">Page Range:</span> <strong>${order.pageRange}</strong></div>
        </div>

        ${order.instructions ? `
          <div style="margin-bottom: 16px; padding: 10px; background: var(--warning-bg); border: 1px solid var(--warning); border-radius: var(--radius-sm);">
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--warning);">Customer Instructions:</div>
            <div>${escapeHtml(order.instructions)}</div>
          </div>
        ` : ''}

        <div style="padding: 12px; background: var(--bg-hover); border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span class="text-muted">Subtotal:</span>
            <span>₹${order.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span class="text-muted">GST Tax:</span>
            <span>₹${order.tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1rem; color: var(--accent); border-top: 1px solid var(--border); padding-top: 6px;">
            <span>Total Collected:</span>
            <span>₹${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  } catch (err) {
    showToast('Failed to load order details', 'error');
  }
}

function closeAdminOrderModal() {
  const modal = document.getElementById('admin-order-modal');
  if (modal) modal.classList.remove('open');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
