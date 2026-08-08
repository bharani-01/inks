/**
 * Printa — Admin Document Management Logic
 */
let currentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
  loadDocuments();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        currentPage = 1;
        loadDocuments();
      }
    });
  }
});

async function loadDocuments() {
  const tbody = document.getElementById('docs-tbody');
  const searchInput = document.getElementById('search-input');
  const search = searchInput ? searchInput.value.trim() : '';

  if (!tbody) return;

  try {
    const data = await api.get(`/admin/documents?page=${currentPage}&limit=10&search=${encodeURIComponent(search)}`);
    const { documents, pagination } = data;

    if (!documents || documents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
            No documents found matching your criteria.
          </td>
        </tr>
      `;
      document.getElementById('pagination-info').textContent = '0 documents';
      document.getElementById('pagination-controls').innerHTML = '';
      return;
    }

    tbody.innerHTML = documents.map(doc => {
      const isAutoDeleted = doc.filePath && doc.filePath.startsWith('[AUTO_DELETED]');
      const fileTypeLabel = getFileTypeLabel(doc.mimeType);

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="doc-icon ${fileTypeLabel.toLowerCase()}" style="flex-shrink: 0;">${getFileIcon(doc.mimeType)}</div>
              <div style="min-width: 0;">
                <div style="font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">
                  ${escapeHtml(doc.originalName)}
                </div>
                <span class="badge badge-neutral" style="font-size: 0.6875rem; padding: 2px 6px;">${fileTypeLabel}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 500; font-size: 0.875rem;">${escapeHtml(doc.user ? doc.user.name : 'Unknown User')}</div>
            <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(doc.user ? doc.user.email : '')}</div>
          </td>
          <td><span style="font-size: 0.8125rem;">${formatFileSize(doc.fileSize)}</span></td>
          <td>${renderStatusBadge(doc, isAutoDeleted)}</td>
          <td>${new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${isAutoDeleted ? `
                <button class="btn btn-ghost btn-sm" disabled title="File Auto-Deleted">${icons.eyeOff}</button>
              ` : `
                <button class="btn btn-ghost btn-sm" onclick="previewDoc(${doc.id})" title="Preview / Download">${icons.download}</button>
              `}
              <button class="btn btn-ghost btn-sm" style="color: var(--error);" onclick="confirmDeleteDoc(${doc.id}, '${escapeJsString(doc.originalName)}')" title="Delete File">${icons.trash}</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination(pagination);
  } catch (err) {
    showToast('Failed to load document list', 'error');
  }
}

function renderStatusBadge(doc, isAutoDeleted) {
  if (isAutoDeleted) {
    return `<span class="badge badge-neutral" style="color: var(--text-muted);" title="File purged 30m after printing">Purged (30m)</span>`;
  }
  if (doc.status === 'PRINTED') {
    return `<span class="badge badge-success">Printed (Auto-deleting)</span>`;
  }
  if (doc.status === 'PROCESSING') {
    return `<span class="badge badge-accent">Processing</span>`;
  }
  return `<span class="badge badge-neutral">Uploaded</span>`;
}

function previewDoc(id) {
  const token = api.getToken();
  window.location.href = `/api/documents/${id}/preview?download=true&token=${encodeURIComponent(token)}`;
}

async function confirmDeleteDoc(id, name) {
  if (confirm(`Are you sure you want to permanently delete "${name}"?`)) {
    try {
      await api.delete(`/documents/${id}`);
      showToast('Document deleted successfully', 'success');
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
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
  loadDocuments();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeJsString(str) {
  return (str || '').replace(/'/g, "\\'");
}
