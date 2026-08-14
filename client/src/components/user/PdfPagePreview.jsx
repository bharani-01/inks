import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Eye,
  Layers,
  ZoomIn,
  ZoomOut,
  FileText,
  Smartphone,
  Monitor,
  CheckCircle,
  Sliders,
  Filter,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCw,
  Columns,
  Grid,
  Square,
  CheckSquare,
  Trash2,
} from 'lucide-react';
import { previewUrl } from '../../lib/api.js';

// Configure PDF.js worker using Vite asset URL for 100% version-matched local loading
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Parse page range string (e.g., "1-3, 5, 7-9") into array of page numbers (1-indexed)
 */
export function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || String(rangeStr).trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const selected = new Set();
  const parts = String(rangeStr).split(',');

  for (const part of parts) {
    const clean = part.trim();
    if (clean.includes('-')) {
      const [start, end] = clean.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) selected.add(i);
      }
    } else {
      const page = parseInt(clean, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        selected.add(page);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/**
 * Toggle a page in the current range string and return the updated string
 */
export function togglePageInRange(pageNum, currentRangeStr, totalPages) {
  const currentPages = new Set(parsePageRange(currentRangeStr, totalPages));
  if (currentPages.has(pageNum)) {
    currentPages.delete(pageNum);
  } else {
    currentPages.add(pageNum);
  }

  const sorted = Array.from(currentPages).sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === totalPages) return 'all';

  // Group continuous pages into ranges like "1-3, 5"
  const ranges = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = start;
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

/**
 * Typable Page Jump & Pagination Component: < [ 5 ] / 14 >
 */
function PageJumpInput({ currentPage, numPages, onPageChange }) {
  const [inputValue, setInputValue] = useState(String(currentPage));

  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const handleCommit = () => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= numPages) {
      onPageChange(val);
    } else {
      setInputValue(String(currentPage));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
      e.target.blur();
    }
  };

  return (
    <div className="flex items-center bg-neutral-900/90 border border-neutral-700/80 rounded-xl p-1 shadow-inner">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-25 transition-all"
        title="Previous Page (Left Arrow)"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex items-center px-1.5 text-xs font-mono">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className="w-9 h-7 text-center font-bold text-white bg-neutral-950 border border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          title="Type page number and press Enter"
        />
        <span className="text-neutral-400 mx-1.5 font-sans font-medium">/</span>
        <span className="text-neutral-300 font-semibold">{numPages}</span>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
        disabled={currentPage >= numPages}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-25 transition-all"
        title="Next Page (Right Arrow)"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/**
 * Ultra-Professional Full Page Expand Modal Viewer
 */
function FullPageModal({
  doc,
  pdf,
  initialPage = 1,
  numPages,
  orientation,
  grayscale,
  selectedSet,
  onTogglePage,
  onClose,
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [extraRotation, setExtraRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  // Keyboard navigation (Arrow keys & Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setCurrentPage((p) => Math.max(1, p - 1));
      else if (e.key === 'ArrowRight') setCurrentPage((p) => Math.min(numPages, p + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, onClose]);

  // Render high-res page canvas in natural aspect ratio
  useEffect(() => {
    let cancelled = false;
    let renderTask = null;
    setLoading(true);

    async function renderFullPage() {
      if (!pdf || !canvasRef.current) return;
      try {
        const page = await pdf.getPage(currentPage);
        if (cancelled) return;

        const naturalRotation = page.rotate || 0;
        const desiredRotation = (naturalRotation + extraRotation) % 360;

        // Base scale for crystal clear, high-resolution rendering
        const baseScale = 1.35;
        const finalScale = baseScale * zoomLevel;
        const viewport = page.getViewport({ scale: finalScale, rotation: desiredRotation });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Full page render error:', err);
        }
      }
    }

    renderFullPage();
    return () => {
      cancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdf, currentPage, zoomLevel, extraRotation]);

  const isSelected = selectedSet.has(currentPage);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in text-slate-900"
      onClick={onClose}
    >
      {/* Centered Light Theme Modal Window (Matching Screenshot 3) */}
      <div
        className="bg-white rounded-[32px] max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h3 className="font-display font-bold text-lg text-slate-900">Print Preview</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Preview (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport Canvas Container */}
        <div className="flex-1 bg-slate-50/70 p-6 sm:p-8 flex items-center justify-center relative overflow-auto min-h-[380px] select-none">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 z-20">
              <span className="spinner text-emerald-600 text-2xl" />
              <p className="text-xs font-semibold text-slate-600">Rendering Sheet {currentPage}...</p>
            </div>
          )}

          {/* Floating Right Next Arrow Button */}
          {currentPage < numPages && (
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              className="absolute right-4 h-11 w-11 rounded-full bg-white/95 hover:bg-white text-slate-700 shadow-lg border border-slate-200 flex items-center justify-center transition-all hover:scale-105 z-20 cursor-pointer"
              title="Next Sheet"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Paper Sheet Preview */}
          <div className="bg-white shadow-[0_15px_45px_rgba(0,0,0,0.12)] border border-slate-200 rounded-sm overflow-hidden p-1">
            <canvas
              ref={canvasRef}
              className={`block max-h-[60vh] max-w-full w-auto h-auto object-contain ${grayscale ? 'grayscale contrast-125' : ''}`}
            />
          </div>
        </div>

        {/* Footer (Matching Screenshot 3 EXACTLY!) */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-900 truncate max-w-[180px] sm:max-w-[240px]">
              {doc?.originalName || 'Document Preview'}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sheet {currentPage} of {numPages}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Prev Button */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-11 w-11 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-25 text-slate-700 border border-slate-200/80 flex items-center justify-center transition-colors cursor-pointer"
              title="Previous Sheet"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Green Next > Button */}
            <button
              type="button"
              onClick={() => {
                if (currentPage < numPages) {
                  setCurrentPage((p) => p + 1);
                } else {
                  onClose();
                }
              }}
              className="h-11 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
            >
              <span>{currentPage < numPages ? 'Next' : 'Done'}</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ThumbnailItem({
  pdf,
  pageNum,
  totalPages,
  isSelected,
  sequenceIndex,
  orientation,
  grayscale,
  onClick,
  onExpand,
  onDelete,
}) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function renderThumbnail() {
      if (!pdf || !canvasRef.current) return;
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const naturalRotation = page.rotate || 0;
        const unrotatedViewport = page.getViewport({ scale: 1.0, rotation: 0 });
        const isNaturallyLandscape = unrotatedViewport.width > unrotatedViewport.height;

        let desiredRotation = naturalRotation;
        if (orientation === 'LANDSCAPE' && !isNaturallyLandscape) {
          desiredRotation = (naturalRotation + 90) % 360;
        } else if (orientation === 'PORTRAIT' && isNaturallyLandscape) {
          desiredRotation = (naturalRotation + 90) % 360;
        }

        // Crisp rendering scale
        const scale = orientation === 'LANDSCAPE' ? 0.55 : 0.5;
        const viewport = page.getViewport({ scale, rotation: desiredRotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Failed to render page ${pageNum}:`, err.message);
        }
      }
    }

    renderThumbnail();
    return () => {
      cancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdf, pageNum, orientation]);

  return (
    <div className="rounded-2xl border border-slate-200/80 transition-all p-2 bg-white flex flex-col select-none group shadow-xs hover:shadow-md">
      {/* Canvas container with fixed dimensions — click to expand full page */}
      <div
        onClick={() => onExpand(pageNum)}
        className="relative w-full h-[400px] flex items-center justify-center overflow-hidden rounded-xl bg-slate-50 my-1 p-2 cursor-pointer hover:opacity-95 transition-all shadow-inner border border-slate-100"
        title="Click to view full page"
      >
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white text-red-600 border border-red-300 shadow-md flex items-center justify-center hover:bg-red-50 hover:scale-110 transition-all z-20 cursor-pointer"
            title="Delete uploaded file"
          >
            <Trash2 size={15} />
          </button>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-ink-muted gap-1.5 bg-slate-100/90 z-0">
            <span className="spinner text-accent text-lg" />
            <span>Loading Page {pageNum}...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-[360px] w-auto h-auto object-contain rounded-xs shadow-md border border-slate-200/80 transition-all ${
            grayscale ? 'grayscale contrast-125' : ''
          } ${loading ? 'hidden' : 'block'}`}
        />

        {/* Bottom Center PREVIEW Pill Overlay */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(pageNum);
            }}
            className="btn bg-white/95 hover:bg-white text-slate-800 font-bold text-xs h-9 px-5 rounded-xl border border-slate-300 shadow-md flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <Maximize2 size={14} className="text-slate-600" />
            <span>PREVIEW</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PdfPagePreview({
  doc,
  pageRange = 'all',
  orientation = 'PORTRAIT',
  grayscale = false,
  onPageRangeChange,
  onDelete,
  height = '520px',
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('SELECTED'); // 'SELECTED' | 'ALL'
  const [gridColumns, setGridColumns] = useState('2'); // '1' | '2' | '3'
  const [expandedPage, setExpandedPage] = useState(null);

  const src = previewUrl(doc?.id);

  useEffect(() => {
    if (!doc?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status} ${response.statusText})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const loadedPdf = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err) {
        console.error('PDF.js load error:', err);
        if (!cancelled) setError(err.message || 'Failed to render PDF page thumbnails');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [doc?.id, src]);

  const selectedPages = parsePageRange(pageRange, numPages || doc?.pageCount || 1);
  const selectedSet = new Set(selectedPages);

  // Pages to display based on active view mode
  const displayedPages =
    viewMode === 'SELECTED'
      ? selectedPages
      : Array.from({ length: numPages || doc?.pageCount || 1 }, (_, i) => i + 1);

  const handleTogglePage = (pageNum) => {
    if (typeof onPageRangeChange === 'function') {
      const newRange = togglePageInRange(pageNum, pageRange, numPages || doc?.pageCount || 1);
      onPageRangeChange(newRange);
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-3xl border border-line bg-paper-sunken flex flex-col items-center justify-center p-10 text-center"
        style={{ minHeight: height }}
      >
        <span className="spinner text-accent text-3xl mb-3" />
        <p className="font-display font-semibold text-ink text-base">Rendering Document Pages...</p>
        <p className="text-xs text-ink-muted mt-1">Generating crisp, uncompressed page previews</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl overflow-hidden border border-line bg-white shadow-inner">
        <iframe
          src={src}
          title={`Preview of ${doc.originalName}`}
          className="w-full border-0"
          style={{ height, filter: grayscale ? 'grayscale(100%)' : 'none' }}
        />
      </div>
    );
  }

  const isLandscape = orientation === 'LANDSCAPE';

  // Responsive grid class based on column density setting
  const gridClass =
    gridColumns === '1'
      ? 'grid-cols-1'
      : gridColumns === '3'
      ? 'grid-cols-2 sm:grid-cols-3'
      : isLandscape
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <>
      <ThumbnailItem
        pdf={pdfDoc}
        pageNum={1}
        totalPages={numPages}
        isSelected={selectedSet.has(1)}
        sequenceIndex={0}
        orientation={orientation}
        grayscale={grayscale}
        onClick={onPageRangeChange ? () => handleTogglePage(1) : undefined}
        onExpand={(p) => setExpandedPage(p || 1)}
        onDelete={onDelete ? () => onDelete(doc.id) : undefined}
      />

      {/* Full Page Expand Modal — Interactive viewer for all pages */}
      {expandedPage !== null && (
        <FullPageModal
          doc={doc}
          pdf={pdfDoc}
          initialPage={expandedPage}
          numPages={numPages}
          orientation={orientation}
          grayscale={grayscale}
          selectedSet={selectedSet}
          onTogglePage={onPageRangeChange ? handleTogglePage : undefined}
          onClose={() => setExpandedPage(null)}
        />
      )}
    </>
  );
}
