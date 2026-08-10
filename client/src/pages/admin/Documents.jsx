import { useState, useEffect } from 'react';
import { api, previewUrl } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import { EmptyState } from '../../components/States';
import { formatFileSize, formatDate } from '../../lib/format';
import { FileText, Search, Trash2, Download } from 'lucide-react';
import FileTypeIcon from '../../components/FileTypeIcon';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const toast = useToast();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: 15,
        search
      });
      const data = await api.get(`/admin/documents?${query}`);
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
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const deleteDocument = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.del(`/documents/${id}`);
      toast('Document deleted', 'success');
      fetchDocuments();
    } catch (err) {
      toast(err.message || 'Failed to delete document', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">User Documents</h1>
          <p className="text-ink-muted mt-1">Manage files uploaded by users.</p>
        </div>
      </header>

      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              type="text"
              placeholder="Search by filename or owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent-soft outline-none text-sm transition-shadow"
            />
          </div>
          <button type="submit" className="btn btn-secondary whitespace-nowrap">
            Search
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        {loading && documents.length === 0 ? (
          <div className="p-12 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents found"
            description="Adjust your search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">File</th>
                  <th className="px-6 py-4 font-medium">Owner</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Uploaded At</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-paper-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileTypeIcon mimeType={doc.mimeType} size={20} boxed />
                        <div className="min-w-0 max-w-[200px]">
                          <p className="font-medium text-ink truncate" title={doc.originalName}>
                            {doc.originalName}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatFileSize(doc.fileSize)} {doc.pageCount ? `• ${doc.pageCount} pages` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-ink">{doc.user.name}</div>
                      <div className="text-xs text-ink-muted">{doc.user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-hover text-ink-soft border border-line">
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-ink-muted">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={previewUrl(doc.id, { download: true })}
                          className="p-2 text-ink-muted hover:text-ink hover:bg-paper-hover rounded-lg transition-colors"
                          title="Download"
                          download
                        >
                          <Download size={18} />
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc.id)}
                          className="p-2 text-danger/70 hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                          title="Delete Document"
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

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
