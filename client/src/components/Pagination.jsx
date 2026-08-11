import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Universal Pagination with "Showing X–Y of Z" info.
 * Supports both prop conventions ({ page, total, onPage } and { currentPage, totalPages, onPageChange }).
 */
export default function Pagination({
  page: pageProp,
  currentPage,
  total: totalProp,
  totalItems,
  totalPages: totalPagesProp,
  limit = 10,
  onPage,
  onPageChange,
  ellipsis = false,
}) {
  const page = Number(currentPage || pageProp || 1);
  const totalPages = Number(totalPagesProp || 1);
  const handlePageChange = onPageChange || onPage || (() => {});

  if (!totalPages || totalPages <= 1) return null;

  const total = Number(totalProp ?? totalItems ?? totalPages * limit);
  const start = total === 0 ? 0 : Math.max(1, (page - 1) * limit + 1);
  const end = Math.min(page * limit, total);

  let pages = [];
  if (!ellipsis || totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const set = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
    const sorted = [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) pages.push('…');
      pages.push(p);
      prev = p;
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
      {total > 0 && !isNaN(start) && !isNaN(end) ? (
        <p className="text-xs sm:text-sm text-ink-muted">
          Showing <span className="font-semibold text-ink">{start}</span>–
          <span className="font-semibold text-ink">{end}</span> of{' '}
          <span className="font-semibold text-ink">{total}</span>
        </p>
      ) : (
        <p className="text-xs sm:text-sm text-ink-muted">
          Page <span className="font-semibold text-ink">{page}</span> of{' '}
          <span className="font-semibold text-ink">{totalPages}</span>
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="h-8.5 w-8.5 inline-flex items-center justify-center rounded-lg border border-line
                     text-ink-soft hover:bg-paper-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-2 text-ink-faint select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => handlePageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-8.5 min-w-8.5 px-2.5 inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-semibold transition-all
                          ${
                            p === page
                              ? 'bg-accent text-white shadow-xs'
                              : 'border border-line text-ink-soft hover:bg-paper-hover'
                          }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="h-8.5 w-8.5 inline-flex items-center justify-center rounded-lg border border-line
                     text-ink-soft hover:bg-paper-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
