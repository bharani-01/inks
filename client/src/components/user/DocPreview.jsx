import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, FileCheck2, ExternalLink, Download, Eye, FileText, AlertCircle, Smartphone, Monitor, Trash2, Maximize2, X } from 'lucide-react';
import { previewUrl, getToken, API_BASE } from '../../lib/api.js';
import { formatFileSize, fileTypeLabel } from '../../lib/format.js';
import FileTypeIcon from '../FileTypeIcon.jsx';
import Button from '../Button.jsx';

import PdfPagePreview from './PdfPagePreview.jsx';

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

const isPdf = (doc) => {
  if (!doc) return false;
  const m = String(doc.mimeType || '').toLowerCase();
  const name = String(doc.originalName || doc.fileName || '').toLowerCase();
  return m === 'application/pdf' || m.includes('pdf') || name.endsWith('.pdf');
};

const isOffice = (doc) => {
  if (!doc) return false;
  const s = String(doc.mimeType || '').toLowerCase();
  const name = String(doc.originalName || doc.fileName || '').toLowerCase();
  return (
    s.includes('presentation') ||
    s.includes('wordprocessingml') ||
    s.includes('msword') ||
    s.includes('vnd.ms-powerpoint') ||
    s.includes('spreadsheetml') ||
    s.includes('ms-excel') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    name.endsWith('.pptx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  );
};

export default function DocPreview({
  doc,
  grayscale,
  onReupload,
  onDelete,
  pageRange = 'all',
  orientation = 'PORTRAIT',
  onPageRangeChange,
  height = '520px',
}) {
  const [iframeError, setIframeError] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);

  if (!doc) return null;

  const autoDeleted = doc.filePath && String(doc.filePath).startsWith('[AUTO_DELETED]');

  if (autoDeleted) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-8 text-center">
        <div className="h-12 w-12 mx-auto rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center">
          <ShieldAlert size={24} />
        </div>
        <h4 className="mt-3 font-display font-semibold text-ink">File Purged for Privacy (30-Minute Policy)</h4>
        <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
          This document was automatically deleted 30 minutes after printing in accordance with the data privacy policy.
        </p>
        {onReupload && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onReupload}>
              Upload Fresh Copy
            </Button>
          </div>
        )}
      </div>
    );
  }

  const src = previewUrl(doc.id);
  const filterStyle = grayscale ? { filter: 'grayscale(100%) contrast(115%)' } : undefined;
  const isLandscape = orientation === 'LANDSCAPE';

  // PDF Preview — uses interactive thumbnail page range viewer
  if (isPdf(doc)) {
    return (
      <PdfPagePreview
        doc={doc}
        pageRange={pageRange}
        orientation={orientation}
        grayscale={grayscale}
        onPageRangeChange={onPageRangeChange}
        onDelete={onDelete}
        height={height}
      />
    );
  }

  // Image Preview
  if (isImage(doc)) {
    return (
      <>
        <div
          onClick={() => setImageExpanded(true)}
          className="rounded-2xl border border-slate-200/80 bg-white flex items-center justify-center p-3 relative cursor-pointer group shadow-xs hover:shadow-md transition-all select-none h-[416px] w-full"
        >
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(doc.id);
              }}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white text-red-600 border border-red-300 shadow-md flex items-center justify-center hover:bg-red-50 hover:scale-110 transition-all z-20 cursor-pointer"
              title="Delete uploaded document"
            >
              <Trash2 size={15} />
            </button>
          )}

          <img
            src={src}
            alt={doc.originalName}
            className={`max-w-full max-h-[380px] w-auto h-auto object-contain rounded-xl shadow-md transition-transform duration-300 group-hover:scale-[1.01] ${
              grayscale ? 'grayscale contrast-125' : ''
            }`}
            style={filterStyle}
          />

          {/* Bottom Center PREVIEW Pill Overlay */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImageExpanded(true);
              }}
              className="btn bg-white/95 hover:bg-white text-slate-800 font-bold text-xs h-9 px-5 rounded-xl border border-slate-300 shadow-md flex items-center gap-2 transition-all hover:scale-105"
            >
              <Maximize2 size={14} className="text-slate-600" />
              <span>PREVIEW</span>
            </button>
          </div>
        </div>

        {/* Full Screen Image Lightbox */}
        {imageExpanded &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in text-slate-900"
              onClick={() => setImageExpanded(false)}
            >
              <div
                className="bg-white rounded-[32px] max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                  <h3 className="font-display font-bold text-lg text-slate-900">Print Preview</h3>
                  <button
                    type="button"
                    onClick={() => setImageExpanded(false)}
                    className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Close Preview (Esc)"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 bg-slate-50/70 p-6 sm:p-8 flex items-center justify-center relative overflow-auto min-h-[360px]">
                  <img
                    src={src}
                    alt={doc.originalName}
                    className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-lg border border-slate-200"
                    style={filterStyle}
                  />
                </div>
                <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-sm text-slate-900 truncate max-w-[200px]">{doc.originalName}</p>
                    <p className="text-xs text-slate-500 font-medium">Sheet 1 of 1</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageExpanded(false)}
                    className="h-11 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all hover:scale-105"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  // Office Documents (Word, PowerPoint, Excel)
  if (isOffice(doc)) {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalhost || iframeError) {
      return (
        <div className="rounded-xl border border-line bg-paper-sunken p-8 text-center" style={{ minHeight: height }}>
          <div className="max-w-md mx-auto space-y-4 pt-4">
            <FileTypeIcon mimeType={doc.mimeType} size={36} boxed className="mx-auto" />
            <div>
              <h4 className="font-display font-semibold text-ink text-base">{doc.originalName}</h4>
              <p className="text-xs text-ink-muted mt-1">
                {fileTypeLabel(doc.mimeType)} ({formatFileSize(doc.fileSize)})
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-line text-xs text-ink-muted text-left space-y-1">
              <span className="font-semibold text-ink block">Document Details</span>
              <div className="flex justify-between py-0.5">
                <span>Total Pages/Slides:</span>
                <span className="font-bold text-ink">{doc.pageCount || 1}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>File Format:</span>
                <span className="font-medium text-ink">{fileTypeLabel(doc.mimeType)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <a
                href={previewUrl(doc.id, { download: true })}
                className="btn btn-primary text-xs inline-flex items-center gap-1.5"
                download
              >
                <Download size={14} /> Download File
              </a>
              <a
                href={previewUrl(doc.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
            </div>
          </div>
        </div>
      );
    }

    const publicUrl = `${window.location.origin}${API_BASE}/documents/${doc.id}/preview?token=${encodeURIComponent(
      getToken() || ''
    )}`;
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
    return (
      <div className="rounded-xl overflow-hidden border border-line bg-white" style={filterStyle}>
        <iframe
          src={viewer}
          title={`Preview of ${doc.originalName}`}
          className="w-full border-0"
          style={{ height }}
          onError={() => setIframeError(true)}
        />
      </div>
    );
  }

  // Fallback Generic Document
  return (
    <div className="rounded-xl border border-line bg-paper-sunken p-8 text-center" style={{ ...filterStyle, minHeight: height }}>
      <div className="max-w-md mx-auto space-y-4 pt-4">
        <div className="h-12 w-12 mx-auto rounded-full bg-accent-soft text-accent inline-flex items-center justify-center">
          <FileCheck2 size={24} />
        </div>
        <div>
          <h4 className="font-display font-semibold text-ink text-base">{doc.originalName}</h4>
          <p className="text-xs text-ink-muted mt-1">
            {fileTypeLabel(doc.mimeType)} ({formatFileSize(doc.fileSize)})
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <a
            href={previewUrl(doc.id, { download: true })}
            className="btn btn-primary text-xs inline-flex items-center gap-1.5"
            download
          >
            <Download size={14} /> Download File
          </a>
          <a
            href={previewUrl(doc.id)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <ExternalLink size={14} /> Open Full View
          </a>
        </div>
      </div>
    </div>
  );
}
