import { useState, useEffect } from 'react';
import { api, previewUrl } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import { EmptyState } from '../../components/States';
import { formatFileSize, formatDateTime, fileTypeLabel } from '../../lib/format';
import { FileText, Search, Trash2, Download, Eye, ArrowUpDown, Filter, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import FileTypeIcon from '../../components/FileTypeIcon';

const LIMIT = 15;

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [typeFilter, setTypeFilter] = useState('');

  const toast = useToast();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: LIMIT,
        search: search.trim(),
        sortBy,
        type: typeFilter,
      });
      const data = await api.get(`/documents/admin?${query}`);
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (err) {
      toast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, typeFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const resetFilters = () => {
    setSearch('');
    setSortBy('created_desc');
    setTypeFilter('');
    setPage(1);
  };

  const deleteDocument = async (doc) => {
    if (!window.confirm(`Permanently delete "${doc.originalName}"? This cannot be undone.`)) return;
    try {
      await api.del(`/documents/${doc.id}`);
      toast('Document deleted', 'success');
      fetchDocuments();
    } catch (err) {
      toast(err.message || 'Failed to delete document', 'error');
    }
  };

  const hasActiveFilters = Boolean(search || typeFilter || sortBy !== 'created_desc');

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">User Documents</h1>
          <p className="text-ink-muted mt-1">Audit, search, and manage all uploaded print files across the platform.</p>
        </div>
      </header>

      {/* Filter / Search bar */}
      <div className="card p-4 space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={17} />
            <input
              type="text"
              placeholder="Search by file name, owner name, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-line rounded-xl text-xs sm:text-sm text-ink outline-none focus:ring-2 focus:ring-accent/15 bg-white"
            />
          </div>
          <button type="submit" className="btn btn-primary text-xs whitespace-nowrap px-4 py-2">
            <Search size={14} /> Search
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-secondary text-xs whitespace-nowrap px-3 py-2 text-ink-muted hover:text-ink flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Reset
            </button>
          )}
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Sort By */}
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
              <option value="size_desc">Largest File Size</option>
              <option value="size_asc">Smallest File Size</option>
              <option value="name_asc">File Name (A to Z)</option>
              <option value="pages_desc">Most Pages First</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <Filter size={11} /> File Format
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full border border-line rounded-xl px-3 py-2 text-xs text-ink bg-white outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer font-medium"
            >
              <option value="">All Formats (PDF &amp; Images)</option>
              <option value="pdf">PDF Documents (.pdf)</option>
              <option value="image">Images (.png, .jpg, .webp)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card overflow-hidden shadow-card">
        {loading && documents.length === 0 ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents found"
            description="Adjust your search criteria or filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover/70 border-b border-line text-ink-muted uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Document Name</th>
                  <th className="px-6 py-3.5 font-semibold">Owner</th>
                  <th className="px-6 py-3.5 font-semibold">Size &amp; Pages</th>
                  <th className="px-6 py-3.5 font-semibold">Uploaded At</th>
                  <th className="px-6 py-3.5 font-semibold">Order Association</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((doc) => {
                  const latestOrder = doc.orders?.[0];
                  return (
                    <tr key={doc.id} className="hover:bg-paper-hover/60 transition-colors">
                      {/* Document Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5 max-w-[280px]">
                          <FileTypeIcon mimeType={doc.mimeType} size={20} boxed />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-ink truncate" title={doc.originalName}>
                              {doc.originalName}
                            </p>
                            <span className="text-[10px] uppercase font-bold text-ink-muted">
                              {fileTypeLabel(doc.mimeType)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-4">
                        <div className="text-xs sm:text-sm font-medium text-ink">{doc.user?.name || 'Unknown'}</div>
                        <div className="text-[11px] text-ink-muted">{doc.user?.email}</div>
                      </td>

                      {/* Size & Pages */}
                      <td className="px-6 py-4">
                        <span className="font-semibold text-xs text-ink">{doc.pageCount ? `${doc.pageCount} pages` : '1 page'}</span>
                        <div className="text-[11px] text-ink-muted">{formatFileSize(doc.fileSize)}</div>
                      </td>

                      {/* Uploaded Timestamp */}
                      <td className="px-6 py-4 text-xs text-ink-muted">
                        {formatDateTime(doc.createdAt)}
                      </td>

                      {/* Order Association */}
                      <td className="px-6 py-4">
                        {latestOrder ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-accent">
                              {latestOrder.orderNumber}
                            </span>
                            <span className={`ml-2 badge text-[10px] ${
                              latestOrder.orderStatus === 'PRINTED' || latestOrder.orderStatus === 'DELIVERED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {latestOrder.orderStatus}
                            </span>
                          </div>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-600 text-[10px]">Unprinted Draft</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={previewUrl(doc.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover transition-colors"
                            title="Preview file"
                          >
                            <Eye size={15} />
                          </a>
                          <a
                            href={previewUrl(doc.id, { download: true })}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors"
                            title="Download file"
                            download
                          >
                            <Download size={15} />
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteDocument(doc)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-soft transition-colors"
                            title="Delete file"
                          >
                            <Trash2 size={15} />
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

        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-line">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={LIMIT}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
