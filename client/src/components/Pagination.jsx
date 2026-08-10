import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination with "Showing X–Y of Z" info. `ellipsis` collapses long ranges.
 * Mirrors the legacy pagination (limit 10) used across the user zone.
 */
export default function Pagination({ page, total, totalPages, limit = 10, onPage, ellipsis = false }) {
  if (!totalPages || totalPages <= 0) return null;

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-sm text-ink-muted">
        Showing <span className="font-medium text-ink-soft">{start}</span>–
        <span className="font-medium text-ink-soft">{end}</span> of{' '}
        <span className="font-medium text-ink-soft">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line
                     text-ink-soft hover:bg-paper-hover disabled:opacity-40 disabled:pointer-events-none"
          onClick={() => onPage(page - 1)}
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
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-9 min-w-9 px-2 inline-flex items-center justify-center rounded-lg text-sm font-medium
                          ${
                            p === page
                              ? 'bg-accent text-white'
                              : 'border border-line text-ink-soft hover:bg-paper-hover'
                          }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line
                     text-ink-soft hover:bg-paper-hover disabled:opacity-40 disabled:pointer-events-none"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
