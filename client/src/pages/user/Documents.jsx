import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Printer, Trash2, Eye, FilePlus2, FolderOpen, FileText } from 'lucide-react';
import { api, previewUrl } from '../../lib/api.js';
import { formatFileSize, formatDate, fileTypeLabel } from '../../lib/format.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';

const LIMIT = 10;

export default function Documents() {
  const toast = useToast();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (p) => {
      setLoading(true);
      try {
        const data = await api.get(`/documents?page=${p}&limit=${LIMIT}`);
        setDocuments(data.documents || []);
        setPagination(data.pagination || { page: p, total: 0, totalPages: 0 });
      } catch {
        toast('Failed to load your documents', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    load(page);
  }, [page, load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/documents/${toDelete.id}`);
      toast('Document deleted', 'success');
      setToDelete(null);
      // Reload; step back a page if we just removed the last item on it.
      const nextCount = documents.length - 1;
      if (nextCount === 0 && page > 1) setPage((p) => p - 1);
      else load(page);
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const isDeleted = (d) => d.status === 'DELETED';

  const filtered = documents.filter((d) =>
    d.originalName?.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="max-w-content mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-accent-soft text-accent inline-flex items-center justify-center">
            <FileText size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">My documents</h1>
            <p className="text-ink-muted mt-0.5">Everything you've uploaded, ready to reprint.</p>
          </div>
        </div>
        <Link to="/user/print" className="btn btn-primary hidden sm:inline-flex">
          <FilePlus2 size={18} /> Upload &amp; print
        </Link>
      </div>

      {loading ? (
        <PageLoader label="Loading your documents…" />
      ) : documents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Upload a file from the Print Hub and it'll be saved here for quick reprints."
            action={
              <Link to="/user/print" className="btn btn-primary">
                <FilePlus2 size={18} /> Upload a document
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-line">
            <div className="relative max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your documents"
                aria-label="Search documents"
                className="field-input pl-9"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted py-12 text-center">No documents match your search.</p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((d) => {
                const deleted = isDeleted(d);
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 sm:px-5 py-4">
                    <FileTypeIcon mimeType={d.mimeType} size={20} boxed />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{d.originalName}</p>
                      <p className="text-xs text-ink-muted">
                        <span className="uppercase">{fileTypeLabel(d.mimeType)}</span> ·{' '}
                        {formatFileSize(d.fileSize)} · {d.pageCount ? `${d.pageCount} pages` : '—'} ·{' '}
                        {formatDate(d.createdAt)}
                        {deleted && <span className="ml-2 badge badge-neutral">Auto-deleted</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!deleted && (
                        <a
                          href={previewUrl(d.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-muted hover:bg-paper-hover hover:text-ink"
                          aria-label={`Preview ${d.originalName}`}
                          title="Preview"
                        >
                          <Eye size={17} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/user/print?docId=${d.id}&step=2`)}
                        disabled={deleted}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-muted hover:bg-accent-soft hover:text-accent disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={`Print ${d.originalName}`}
                        title="Print"
                      >
                        <Printer size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(d)}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Delete ${d.originalName}`}
                        title="Delete"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-5 py-4 border-t border-line">
            <Pagination
              page={pagination.page}
              total={pagination.total}
              totalPages={pagination.totalPages}
              limit={LIMIT}
              onPage={setPage}
              ellipsis
            />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        open={!!toDelete}
        onClose={() => (deleting ? null : setToDelete(null))}
        title="Delete document?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting} loadingText="Deleting…">
              <Trash2 size={16} /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Permanently delete{' '}
          <span className="font-semibold text-ink">{toDelete?.originalName}</span>? This can't be undone.
          Orders you've already placed are unaffected.
        </p>
      </Modal>
    </div>
  );
}
