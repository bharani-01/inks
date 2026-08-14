import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X, Check, CheckSquare, Square, Layers, FileText } from 'lucide-react';
import { previewUrl, getToken } from '../../lib/api.js';
import { parsePageRange, togglePageInRange } from './PdfPagePreview.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const isImage = (doc) => {
  if (!doc) return false;
  const m = String(doc.mimeType || '').toLowerCase();
  const name = String(doc.originalName || doc.fileName || '').toLowerCase();
  return (
    m.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  );
};

function PageCard({ doc, pdf, pageNum, isSelected, onClick, grayscale }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(Boolean(pdf));
  const [error, setError] = useState(false);

  const src = previewUrl(doc?.id);
  const token = getToken();
  const authedSrc = token ? `${src}${src.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : src;

  useEffect(() => {
    if (!pdf) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let renderTask = null;
    setLoading(true);

    async function renderPage() {
      if (!canvasRef.current) return;
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdf, pageNum]);

  const isImg = isImage(doc);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border transition-all p-3 flex flex-col items-center justify-between text-left select-none group cursor-pointer ${
        isSelected
          ? 'border-2 border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-md scale-[1.02]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 opacity-60 hover:opacity-90'
      }`}
    >
      {/* Checkbox badge top right */}
      <div
        className={`absolute top-2.5 right-2.5 h-6 w-6 rounded-lg flex items-center justify-center transition-all z-10 ${
          isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-400 group-hover:bg-slate-300'
        }`}
      >
        <Check size={14} strokeWidth={3} className={isSelected ? 'scale-100' : 'scale-0'} />
      </div>

      <div className="w-full h-40 flex items-center justify-center overflow-hidden rounded-xl bg-slate-100/80 my-1 p-1.5 border border-slate-200/60 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[11px] text-slate-400 bg-slate-100 z-10">
            <span className="spinner text-indigo-600 text-sm" />
            <span>Page {pageNum}</span>
          </div>
        )}

        {pdf && !error ? (
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain rounded shadow-xs ${
              grayscale ? 'grayscale contrast-125' : ''
            }`}
          />
        ) : isImg ? (
          <img
            src={authedSrc}
            alt={`Page ${pageNum}`}
            className={`max-w-full max-h-full object-contain rounded shadow-xs ${
              grayscale ? 'grayscale contrast-125' : ''
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
            <FileText size={32} className="text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-500">Sheet {pageNum}</span>
          </div>
        )}
      </div>

      <div className="w-full flex items-center justify-between mt-1 pt-1.5 border-t border-slate-100 text-xs">
        <span className={`font-bold ${isSelected ? 'text-indigo-950' : 'text-slate-600'}`}>
          Sheet {pageNum}
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {isSelected ? 'Selected' : 'Skipped'}
        </span>
      </div>
    </button>
  );
}

export default function VisualPageSelectorModal({
  doc,
  pageRange,
  onPageRangeChange,
  onClose,
  grayscale = false,
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(doc?.pageCount || 1);
  const [loading, setLoading] = useState(true);
  const [tempRange, setTempRange] = useState(pageRange || 'all');

  const src = previewUrl(doc?.id);

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  useEffect(() => {
    if (!doc?.id) return;
    let cancelled = false;

    async function loadPdf() {
      try {
        const token = getToken();
        const authedUrl = token
          ? `${src}${src.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
          : src;

        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(authedUrl, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const loadedPdf = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err) {
        console.warn('VisualPageSelectorModal PDF load notice:', err.message);
        setNumPages(doc?.pageCount || 1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [doc?.id, src]);

  const selectedPages = parsePageRange(tempRange, numPages);
  const selectedSet = new Set(selectedPages);

  const handleToggle = (pageNum) => {
    const nextRange = togglePageInRange(pageNum, tempRange, numPages);
    setTempRange(nextRange);
  };

  const handleSelectAll = () => {
    setTempRange('all');
  };

  const handleClearAll = () => {
    setTempRange('');
  };

  const handleApply = () => {
    onPageRangeChange(tempRange || 'all');
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in text-slate-900"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-slate-900">
                Visual Page Selector
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-xs sm:max-w-md">
                {doc?.originalName} ({selectedPages.length} of {numPages} sheets selected)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="btn bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold h-8 px-3 rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare size={14} className="text-indigo-600" />
              <span>Select All ({numPages})</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="btn bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold h-8 px-3 rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Square size={14} className="text-slate-400" />
              <span>Clear Selection</span>
            </button>
          </div>

          <div className="text-xs font-mono font-bold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200">
            Selected: <span className="text-indigo-700 font-extrabold">{tempRange === 'all' || selectedPages.length === numPages ? `All ${numPages} Pages` : tempRange || 'None (0 pages)'}</span>
          </div>
        </div>

        {/* Grid of Pages */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/40 min-h-[320px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500">
              <span className="spinner text-indigo-600 text-2xl" />
              <p className="text-xs font-semibold">Loading Page Previews...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <PageCard
                  key={pageNum}
                  doc={doc}
                  pdf={pdfDoc}
                  pageNum={pageNum}
                  isSelected={selectedSet.has(pageNum)}
                  onClick={() => handleToggle(pageNum)}
                  grayscale={grayscale}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary text-xs h-10 px-5 rounded-xl font-semibold cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm h-10 px-6 rounded-xl font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Check size={16} />
            <span>Apply Selected Pages ({selectedPages.length} Sheets)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
