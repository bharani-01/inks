import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Printer,
  Trash2,
  Eye,
  FilePlus2,
  FolderOpen,
  FileText,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { api, previewUrl } from '../../lib/api.js';
import { formatFileSize, formatDate, formatDateTime, fileTypeLabel } from '../../lib/format.js';
import { useToast } from '../../components/Toaster.jsx';
import { PageLoader, EmptyState } from '../../components/States.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import FileTypeIcon from '../../components/FileTypeIcon.jsx';

const LIMIT = 15;

export default function Documents() {
  const toast = useToast();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0, limit: LIMIT });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [statusFilter, setStatusFilter] = useState('');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState([]);

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docsToDelete, setDocsToDelete] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (p, sort = sortBy, status = statusFilter, query = search) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: p,
          limit: LIMIT,
          sortBy: sort,
          status,
          search: query.trim(),
        });
        const data = await api.get(`/documents?${params}`);
        setDocuments(data.documents || []);
        setPagination(data.pagination || { page: p, total: 0, totalPages: 0, limit: LIMIT });
        setSelectedIds([]);
      } catch (err) {
        toast('Failed to load your documents', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast, sortBy, statusFilter, search]
  );

  useEffect(() => {
    load(page, sortBy, statusFilter, search);
  }, [page, sortBy, statusFilter, load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, sortBy, statusFilter, search);
  };

  // Toggle selection for a document
  const toggleSelect = (doc) => {
    if (!doc.canDelete) {
      toast(`Cannot select "${doc.originalName}" because it is currently in print queue.`, 'warning');
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(doc.id) ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
    );
  };

  // Select all deletable documents on current page
  const selectAll = () => {
    const deletableDocs = documents.filter((d) => d.canDelete);
    if (selectedIds.length === deletableDocs.length && deletableDocs.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletableDocs.map((d) => d.id));
    }
  };

  // Open delete modal for single document
  const promptDeleteSingle = (doc) => {
    if (!doc.canDelete) {
      toast(
        `Cannot delete "${doc.originalName}" because it is currently in print queue (#${doc.latestOrder?.orderNumber}).`,
        'error'
      );
      return;
    }
    setDocsToDelete([doc]);
    setDeleteModalOpen(true);
  };

  // Open delete modal for bulk selection
  const promptDeleteBulk = () => {
    const targetDocs = documents.filter((d) => selectedIds.includes(d.id));
    const blockedDocs = targetDocs.filter((d) => !d.canDelete);

    if (blockedDocs.length > 0) {
      toast(
        `Cannot delete: ${blockedDocs.length} selected document(s) are currently in the print queue.`,
        'error'
      );
      return;
    }

    setDocsToDelete(targetDocs);
    setDeleteModalOpen(true);
  };

  // Execute deletion
  const executeDelete = async () => {
    if (docsToDelete.length === 0) return;
    setDeleting(true);

    try {
      if (docsToDelete.length === 1) {
        await api.del(`/documents/${docsToDelete[0].id}`);
        toast('Document deleted successfully', 'success');
      } else {
        const ids = docsToDelete.map((d) => d.id);
        const res = await api.post('/documents/bulk-delete', { documentIds: ids });
        toast(res.message || `Deleted ${ids.length} documents`, 'success');
      }

      setDeleteModalOpen(false);
      setDocsToDelete([]);
      setSelectedIds([]);

      // Reload
      const nextCount = documents.length - docsToDelete.length;
      if (nextCount === 0 && page > 1) {
        setPage((p) => p - 1);
      } else {
        load(page, sortBy, statusFilter, search);
      }
    } catch (err) {
      toast(err.message || 'Failed to delete documents', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const deletableDocsOnPage = documents.filter((d) => d.canDelete);
  const isAllSelected =
    deletableDocsOnPage.length > 0 && selectedIds.length === deletableDocsOnPage.length;

  return (
    <div className="max-w-content mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-accent-soft text-accent inline-flex items-center justify-center shadow-xs">
            <FileText size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink">My Documents</h1>
            <p className="text-ink-muted text-xs sm:text-sm mt-0.5">Manage, sort, and reprint your uploaded documents.</p>
          </div>
        </div>
        <Link to="/user/print" className="btn btn-primary text-xs sm:text-sm inline-flex items-center gap-2 self-start sm:self-auto shadow-sm">
          <FilePlus2 size={16} /> Upload &amp; Print New
        </Link>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="card p-4 space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents by file name..."
              className="w-full pl-9 pr-4 py-2 border border-line rounded-xl text-xs sm:text-sm text-ink outline-none focus:ring-2 focus:ring-accent/15 bg-white"
            />
          </div>
          <button type="submit" className="btn btn-primary text-xs whitespace-nowrap px-4 py-2">
            <Search size={14} /> Search
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {/* Sort By Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowUpDown size={11} /> Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="created_desc">Newest Uploaded First</option>
              <option value="created_asc">Oldest First</option>
              <option value="name_asc">File Name (A to Z)</option>
              <option value="name_desc">File Name (Z to A)</option>
              <option value="size_desc">Largest File Size</option>
              <option value="size_asc">Smallest File Size</option>
              <option value="pages_desc">Most Pages First</option>
              <option value="pages_asc">Least Pages First</option>
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <Filter size={11} /> Print Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="">All Documents</option>
              <option value="PRINTED">Printed / Completed</option>
              <option value="IN_PROGRESS">Printing in Progress</option>
              <option value="DRAFT">Draft / Unprinted</option>
            </select>
          </div>

          {/* Select All Toggle on Desktop */}
          {deletableDocsOnPage.length > 0 && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={selectAll}
                className="w-full py-2 px-3 border border-line rounded-xl text-xs font-semibold text-ink-soft hover:bg-paper-hover hover:text-ink transition-colors flex items-center justify-center gap-2 bg-white"
              >
                {isAllSelected ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                <span>{isAllSelected ? 'Deselect All' : 'Select All Available'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Documents List */}
      {loading && documents.length === 0 ? (
        <PageLoader label="Loading documents..." />
      ) : documents.length === 0 ? (
        <div className="card p-8 sm:p-12">
          <EmptyState
            icon={FolderOpen}
            title="No documents found"
            description="Upload a document from the Print Hub to configure and print."
            action={
              <Link to="/user/print" className="btn btn-primary text-xs">
                <FilePlus2 size={16} /> Upload a document
              </Link>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden shadow-card">
          <ul className="divide-y divide-line">
            {documents.map((d) => {
              const selected = selectedIds.includes(d.id);
              const inProgress = d.isPrintingInProgress;
              const isAutoDeleted = d.status === 'PRINTED';

              return (
                <li
                  key={d.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 transition-colors ${
                    selected ? 'bg-accent-soft/40' : 'hover:bg-paper-hover/50'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(d)}
                      disabled={!d.canDelete}
                      className={`mt-1 sm:mt-0 shrink-0 transition-colors ${
                        !d.canDelete
                          ? 'opacity-30 cursor-not-allowed text-ink-muted'
                          : selected
                          ? 'text-accent'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                      title={!d.canDelete ? 'Cannot delete document while in print queue' : 'Select document'}
                    >
                      {selected ? <CheckSquare size={19} /> : <Square size={19} />}
                    </button>

                    {/* File Icon */}
                    <FileTypeIcon mimeType={d.mimeType} size={22} boxed />

                    {/* Meta info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-semibold text-ink truncate max-w-md" title={d.originalName}>
                          {d.originalName}
                        </p>
                        {inProgress ? (
                          <span className="badge bg-amber-100 text-amber-800 border border-amber-200 text-[10px] flex items-center gap-1">
                            <Clock size={10} /> Printing in Progress
                          </span>
                        ) : d.isPrinted ? (
                          <span className="badge bg-green-100 text-green-800 border border-green-200 text-[10px] flex items-center gap-1">
                            <CheckCircle2 size={10} /> Printed
                          </span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                            Draft
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] sm:text-xs text-ink-muted mt-0.5">
                        <span className="uppercase font-medium">{fileTypeLabel(d.mimeType)}</span> ·{' '}
                        {formatFileSize(d.fileSize)} · {d.pageCount ? `${d.pageCount} pages` : '1 page'} ·{' '}
                        Uploaded {formatDateTime(d.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 shrink-0 pl-8 sm:pl-0">
                    <a
                      href={previewUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8.5 w-8.5 inline-flex items-center justify-center rounded-lg text-ink-muted hover:bg-paper-hover hover:text-ink transition-colors"
                      title="Preview Document"
                    >
                      <Eye size={16} />
                    </a>

                    <button
                      type="button"
                      onClick={() => navigate(`/user/print?docId=${d.id}&step=2`)}
                      className="h-8.5 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-soft text-accent hover:bg-accent hover:text-white transition-all text-xs font-semibold"
                      title="Print / Configure order"
                    >
                      <Printer size={14} /> Print
                    </button>

                    <button
                      type="button"
                      onClick={() => promptDeleteSingle(d)}
                      disabled={!d.canDelete}
                      className={`h-8.5 w-8.5 inline-flex items-center justify-center rounded-lg transition-colors ${
                        !d.canDelete
                          ? 'text-gray-300 cursor-not-allowed opacity-50'
                          : 'text-ink-muted hover:bg-danger-soft hover:text-danger'
                      }`}
                      title={!d.canDelete ? 'Cannot delete document currently in print queue' : 'Delete document'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          <div className="px-5 py-4 border-t border-line">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={LIMIT}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Floating Multi-Select Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-5 inset-x-4 max-w-md mx-auto z-40 bg-ink text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-fade-up border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 pl-1">
            <span className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-medium text-white/90">
              {selectedIds.length === 1 ? '1 document selected' : `${selectedIds.length} documents selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={promptDeleteBulk}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Trash2 size={13} /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => (deleting ? null : setDeleteModalOpen(false))}
        title={docsToDelete.length > 1 ? `Delete ${docsToDelete.length} Documents?` : 'Delete Document?'}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={executeDelete}
              loading={deleting}
              loadingText="Deleting..."
            >
              <Trash2 size={15} /> Confirm &amp; Delete
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-ink font-semibold">
              {docsToDelete.length === 1 ? `"${docsToDelete[0]?.originalName}"` : `${docsToDelete.length} selected documents`}
            </strong>
            ? This action cannot be undone.
          </p>

          <div className="p-3 bg-paper-sunken rounded-xl border border-line max-h-36 overflow-y-auto space-y-1.5 text-xs text-ink-muted">
            {docsToDelete.map((d) => (
              <div key={d.id} className="flex items-center gap-2 truncate">
                <FileTypeIcon mimeType={d.mimeType} size={15} boxed />
                <span className="truncate text-ink font-medium">{d.originalName}</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>Completed orders are kept safe in your order history.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
