import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Eye, Layers, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { previewUrl } from '../../lib/api.js';

// Configure PDF.js worker securely over HTTPS
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

/**
 * Parse page range string (e.g., "1-3, 5, 7-9") into array of page numbers (1-indexed)
 */
function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const selected = new Set();
  const parts = rangeStr.split(',');

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

function ThumbnailItem({ pdf, pageNum, isSelected, grayscale }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      if (!pdf || !canvasRef.current) return;
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.warn(`Failed to render page ${pageNum}:`, err.message);
      }
    }

    renderThumbnail();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum]);

  return (
    <div
      className={`relative rounded-xl border-2 transition-all p-1.5 bg-white flex flex-col items-center select-none ${
        isSelected
          ? 'border-emerald-600 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
          : 'border-line/60 opacity-40 hover:opacity-60 bg-slate-50'
      }`}
    >
      {/* Page number badge */}
      <span
        className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold ${
          isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-700/80 text-white'
        }`}
      >
        p. {pageNum}
      </span>

      {/* Canvas container */}
      <div className="relative w-full aspect-[1/1.4] flex items-center justify-center overflow-hidden rounded-lg bg-slate-100">
        {loading && (
          <div className="animate-pulse text-[11px] text-ink-muted flex flex-col items-center gap-1">
            <span className="spinner text-accent" />
            Loading p.{pageNum}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full object-contain ${grayscale ? 'grayscale contrast-125' : ''} ${
            loading ? 'hidden' : 'block'
          }`}
        />
      </div>

      {/* Selection indicator label */}
      <span
        className={`mt-1 text-[10px] font-semibold tracking-wider uppercase ${
          isSelected ? 'text-emerald-700' : 'text-slate-400'
        }`}
      >
        {isSelected ? 'Selected' : 'Skipped'}
      </span>
    </div>
  );
}

export default function PdfPagePreview({ doc, pageRange = 'all', grayscale = false, height = '460px' }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const src = previewUrl(doc?.id);

  useEffect(() => {
    if (!doc?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const loadingTask = pdfjsLib.getDocument(src);
        const loadedPdf = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err) {
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

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-line bg-paper-sunken flex flex-col items-center justify-center p-8 text-center"
        style={{ minHeight: height }}
      >
        <span className="spinner text-accent text-2xl mb-3" />
        <p className="font-display font-semibold text-ink text-sm">Rendering PDF Page Thumbnails...</p>
        <p className="text-xs text-ink-muted mt-1">Generating visual page range verification</p>
      </div>
    );
  }

  if (error) {
    // Fallback to native iframe preview if client-side rendering fails
    return (
      <div className="rounded-xl overflow-hidden border border-line bg-white shadow-inner">
        <iframe
          src={src}
          title={`Preview of ${doc.originalName}`}
          className="w-full border-0"
          style={{ height, filter: grayscale ? 'grayscale(100%)' : 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-slate-50/80 p-4 space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-line">
        <div className="flex items-center gap-2 text-ink font-semibold">
          <Layers size={15} className="text-accent" />
          <span>Pages to Print ({selectedPages.length} of {numPages})</span>
        </div>
        <span className="text-ink-muted font-medium text-[11px]">
          Range: <strong className="text-emerald-700">{pageRange || 'all'}</strong>
        </span>
      </div>

      {/* Page Thumbnails Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1"
        style={{ maxHeight: `calc(${height} - 60px)` }}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <ThumbnailItem
            key={pageNum}
            pdf={pdfDoc}
            pageNum={pageNum}
            isSelected={selectedSet.has(pageNum)}
            grayscale={grayscale}
          />
        ))}
      </div>
    </div>
  );
}
