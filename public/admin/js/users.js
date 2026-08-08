/**
 * Printa — Admin Users Management
 */
let currentPage = 1;
let currentSearch = '';
let currentRoleFilter = '';
let currentStatusFilter = '';
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadUsers();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1;
        loadUsers();
      }, 300);
    });
  }

  const roleFilter = document.getElementById('role-filter');
  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      currentRoleFilter = e.target.value;
      currentPage = 1;
      loadUsers();
    });
  }

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      currentPage = 1;
      loadUsers();
    });
  }

  const modalOverlay = document.getElementById('edit-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeEditModal();
    });
  }

  const editForm = document.getElementById('edit-user-form');
  if (editForm) editForm.addEventListener('submit', handleEditUser);
});

async function loadStats() {
  try {
    const data = await api.get('/users/stats');
    document.getElementById('stat-total').textContent = data.total;
    document.getElementById('stat-active').textContent = data.active;
    document.getElementById('stat-inactive').textContent = data.inactive;
    document.getElementById('stat-admins').textContent = data.admins;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  const emptyState = document.getElementById('empty-state');
  if (!tbody) return;

  try {
    const params = new URLSearchParams({
      page: currentPage, limit: 10,
      search: currentSearch, role: currentRoleFilter, status: currentStatusFilter,
    });
    const data = await api.get(`/users?${params}`);
    const { users, pagination } = data;

    if (users.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      document.getElementById('pagination-info').textContent = '0 results';
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const me = api.getUser();
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="user-info">
              <div class="user-name">${escapeHtml(user.name)}</div>
              <div class="user-email">${escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td>${user.phone || '—'}</td>
        <td>
          <select class="form-select" onchange="handleRoleChange(${user.id}, this.value)" ${user.id === me?.id ? 'disabled title="Cannot change own role"' : ''}>
            <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>User</option>
            <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td>
          <label class="toggle" ${user.id === me?.id ? 'title="Cannot change own status"' : ''}>
            <input type="checkbox" ${user.isActive ? 'checked' : ''} onchange="handleToggleStatus(${user.id}, this)" ${user.id === me?.id ? 'disabled' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td><span class="badge ${user.isActive ? 'badge-success' : 'badge-error'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
        <td>${new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal(${user.id})" title="Edit user">${icons.edit}</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(pagination);
  } catch (err) {
    showToast('Failed to load users', 'error');
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
      if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - page) > 1) {
        if (i === 3 || i === totalPages - 2) html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
        continue;
      }
      html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>${icons.chevronRight}</button>`;
    controlsEl.innerHTML = html;
  }
}

function goToPage(page) { currentPage = page; loadUsers(); }

async function handleRoleChange(userId, newRole) {
  try {
    await api.put(`/users/${userId}`, { role: newRole });
    showToast('Role updated', 'success');
    await loadStats(); await loadUsers();
  } catch (err) { showToast(err.message, 'error'); await loadUsers(); }
}

async function handleToggleStatus(userId, checkbox) {
  const wasChecked = !checkbox.checked;
  try {
    const data = await api.put(`/users/${userId}/toggle-status`);
    showToast(data.message, 'success');
    await loadStats(); await loadUsers();
  } catch (err) { showToast(err.message, 'error'); checkbox.checked = wasChecked; }
}

async function openEditModal(userId) {
  const modal = document.getElementById('edit-modal');
  if (!modal) return;
  try {
    const data = await api.get(`/users/${userId}`);
    const user = data.user;
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-phone').value = user.phone || '';
    document.getElementById('edit-role').value = user.role;
    modal.classList.add('open');
  } catch (err) { showToast('Failed to load user', 'error'); }
}

function closeEditModal() {
  document.getElementById('edit-modal')?.classList.remove('open');
}

async function handleEditUser(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const userId = form.querySelector('#edit-user-id').value;
  const data = {
    name: form.querySelector('#edit-name').value.trim(),
    email: form.querySelector('#edit-email').value.trim(),
    phone: form.querySelector('#edit-phone').value.trim(),
    role: form.querySelector('#edit-role').value,
  };
  if (!data.name || !data.email) { showToast('Name and email are required', 'error'); return; }
  btn.disabled = true;
  try {
    await api.put(`/users/${userId}`, data);
    showToast('User updated successfully', 'success');
    closeEditModal(); await loadStats(); await loadUsers();
  } catch (err) { showToast(err.message, 'error'); } finally { btn.disabled = false; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
