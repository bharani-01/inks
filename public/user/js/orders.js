/**
 * Printa — User Orders Logic (with integrated tracking stepper + mobile cards)
 */
let currentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
  loadMyOrders();

  const modal = document.getElementById('order-detail-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeOrderDetailModal();
    });
  }
});

async function loadMyOrders() {
  const tbody = document.getElementById('orders-tbody');
  const cardsList = document.getElementById('orders-cards-list');
  const emptyState = document.getElementById('empty-state');

  try {
    const data = await api.get(`/orders/my-orders?page=${currentPage}&limit=10`);
    const { orders, pagination } = data;

    if (orders.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (cardsList) cardsList.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      document.getElementById('pagination-info').textContent = '0 orders';
      document.getElementById('pagination-controls').innerHTML = '';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Desktop table rows
    if (tbody) {
      tbody.innerHTML = orders.map(order => `
        <tr onclick="viewOrderDetail(${order.id})" style="cursor: pointer;">
          <td><strong>${order.orderNumber}</strong></td>
          <td>
            <div style="font-weight: 500; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(order.document ? order.document.originalName : 'File')}</div>
          </td>
          <td>
            <span class="badge ${order.colorMode === 'COLOR' ? 'badge-accent' : 'badge-neutral'}">
              ${order.colorMode === 'COLOR' ? 'Color' : 'B&W'}
            </span>
            <span class="text-muted" style="font-size: 0.75rem;">${order.copies}x ${order.paperSize}</span>
          </td>
          <td><strong>₹${order.totalAmount.toFixed(2)}</strong></td>
          <td><span class="badge ${getStatusBadgeClass(order.orderStatus)}">${formatStatus(order.orderStatus)}</span></td>
          <td>${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); viewOrderDetail(${order.id})" title="View Details">${icons.eye}</button>
          </td>
        </tr>
      `).join('');
    }

    // Mobile cards
    if (cardsList) {
      cardsList.innerHTML = orders.map(order => `
        <div class="order-card" onclick="viewOrderDetail(${order.id})">
          <div class="order-card-header">
            <div>
              <div class="order-card-code">${order.orderNumber}</div>
              <div class="order-card-date">${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <span class="badge ${getStatusBadgeClass(order.orderStatus)}">${formatStatus(order.orderStatus)}</span>
          </div>
          <div class="order-card-doc">${escapeHtml(order.document ? order.document.originalName : 'Uploaded File')}</div>
          <div class="order-card-footer">
            <div class="order-card-specs">
              <span class="badge ${order.colorMode === 'COLOR' ? 'badge-accent' : 'badge-neutral'}" style="font-size: 0.6875rem;">
                ${order.colorMode === 'COLOR' ? 'Color' : 'B&W'}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${order.copies}x ${order.paperSize}</span>
            </div>
            <div class="order-card-amount">₹${order.totalAmount.toFixed(2)}</div>
          </div>
        </div>
      `).join('');
    }

    renderPagination(pagination);
  } catch (err) {
    showToast('Failed to load order history', 'error');
  }
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
  loadMyOrders();
}

function buildTrackingStepper(order) {
  const statuses = ['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED'];
  const labels = ['Received', 'Printing', 'Printed', 'Delivered'];
  const currentIndex = statuses.indexOf(order.orderStatus);

  const getStepClass = (stepIndex) => {
    if (order.orderStatus === 'CANCELLED') return 'cancelled';
    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return '';
  };

  return `
    <div class="track-stepper" style="margin: 20px 0;">
      ${statuses.map((s, i) => `
        <div class="track-step ${getStepClass(i)}">
          <div class="step-circle">${getStepClass(i) === 'completed' ? icons.checkCircle : (i + 1)}</div>
          <div class="step-title">${labels[i]}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function viewOrderDetail(id) {
  const modal = document.getElementById('order-detail-modal');
  const content = document.getElementById('order-detail-content');
  if (!modal || !content) return;

  try {
    const data = await api.get(`/orders/${id}`);
    const order = data.order;

    content.innerHTML = `
      <div style="font-size: 0.875rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px;">
          <div>
            <div class="text-muted" style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Order Code</div>
            <div style="font-weight: 700; font-size: 1.25rem;">${order.orderNumber}</div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${getStatusBadgeClass(order.orderStatus)}" style="font-size: 0.8125rem; padding: 5px 12px;">${formatStatus(order.orderStatus)}</span>
          </div>
        </div>

        <!-- Progress Stepper -->
        ${buildTrackingStepper(order)}

        <!-- Document Name -->
        <div style="margin: 16px 0 12px; padding: 12px; background: var(--bg-hover); border-radius: var(--radius-md);">
          <div class="text-muted" style="font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Document</div>
          <div style="font-weight: 600; font-size: 0.9375rem; color: var(--text-primary); word-break: break-word;">${escapeHtml(order.document ? order.document.originalName : 'Document')}</div>
        </div>

        <!-- Specs List -->
        <div style="margin-bottom: 16px; font-size: 0.8125rem;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span class="text-muted">Color Mode</span>
            <strong>${order.colorMode === 'COLOR' ? 'Full Color' : 'Black & White'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span class="text-muted">Paper Size</span>
            <strong>${order.paperSize}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span class="text-muted">Sides</span>
            <strong>${order.sides === 'DOUBLE' ? 'Double-Sided' : 'Single-Sided'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span class="text-muted">Copies</span>
            <strong>${order.copies}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span class="text-muted">Binding</span>
            <strong style="text-transform: capitalize;">${order.binding}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span class="text-muted">Page Range</span>
            <strong>${order.pageRange}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span class="text-muted">Payment</span>
            <strong style="color: var(--success);">PAID</strong>
          </div>
        </div>

        ${order.instructions ? `
          <div style="margin-bottom: 16px; padding: 10px; background: var(--bg-hover); border-radius: var(--radius-sm);">
            <div class="text-muted" style="font-size: 0.75rem;">Special Instructions:</div>
            <div>${escapeHtml(order.instructions)}</div>
          </div>
        ` : ''}

        <!-- Receipt Breakdown -->
        <div style="padding: 14px; background: var(--bg-hover); border-radius: var(--radius-md); margin-bottom: 16px; font-size: 0.875rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span class="text-muted">Subtotal</span>
            <span>₹${order.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span class="text-muted">GST (18%)</span>
            <span>₹${order.tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1rem; color: var(--accent); border-top: 1px solid var(--border); padding-top: 6px;">
            <span>Total Paid</span>
            <span>₹${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="copyTrackLink('${order.orderNumber}')">
            ${icons.share} Share
          </button>
          <a href="/user/quickprint" class="btn btn-primary" style="flex: 1; text-align: center;">
            + New Order
          </a>
        </div>
      </div>
    `;

    modal.classList.add('open');
  } catch (err) {
    showToast('Failed to load order details', 'error');
  }
}

function copyTrackLink(orderNumber) {
  const trackUrl = `${window.location.origin}/user/orders?track=${orderNumber}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(trackUrl).then(() => {
      showToast('Tracking link copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopy(trackUrl);
    });
  } else {
    fallbackCopy(trackUrl);
  }
}

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  showToast('Tracking link copied to clipboard!', 'success');
}

function closeOrderDetailModal() {
  const modal = document.getElementById('order-detail-modal');
  if (modal) modal.classList.remove('open');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Auto-open tracking modal if ?track=PRT-xxx is in the URL
(function checkTrackParam() {
  const params = new URLSearchParams(window.location.search);
  const trackCode = params.get('track');
  if (!trackCode) return;

  const waitAndOpen = async () => {
    try {
      const data = await api.get(`/orders/track/${encodeURIComponent(trackCode)}`);
      if (data && data.order && data.order.id) {
        viewOrderDetail(data.order.id);
      }
    } catch {
      showToast(`Order ${trackCode} not found`, 'error');
    }
  };

  setTimeout(waitAndOpen, 500);
})();
