import { useState } from 'react';
import { ShieldAlert, FileCheck2, ExternalLink, Download, Eye, FileText, AlertCircle } from 'lucide-react';
import { previewUrl, getToken, API_BASE } from '../../lib/api.js';
import { formatFileSize, fileTypeLabel } from '../../lib/format.js';
import FileTypeIcon from '../FileTypeIcon.jsx';
import Button from '../Button.jsx';

const isImage = (m) => String(m).startsWith('image/');
const isPdf = (m) => String(m) === 'application/pdf';
const isOffice = (m) => {
  const s = String(m);
  return (
    s.includes('presentation') ||
    s.includes('wordprocessingml') ||
    s.includes('msword') ||
    s.includes('vnd.ms-powerpoint') ||
    s.includes('spreadsheetml') ||
    s.includes('ms-excel')
  );
};

export default function DocPreview({ doc, grayscale, onReupload, height = '460px' }) {
  const [iframeError, setIframeError] = useState(false);

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

  // PDF Preview
  if (isPdf(doc.mimeType)) {
    return (
      <div className="rounded-xl overflow-hidden border border-line bg-white shadow-inner" style={filterStyle}>
        <iframe
          src={src}
          title={`Preview of ${doc.originalName}`}
          className="w-full border-0"
          style={{ height }}
          onError={() => setIframeError(true)}
        />
      </div>
    );
  }

  // Image Preview
  if (isImage(doc.mimeType)) {
    return (
      <div
        className="rounded-xl overflow-hidden border border-line bg-ink/95 flex items-center justify-center p-4"
        style={{ ...filterStyle, minHeight: height }}
      >
        <img
          src={src}
          alt={doc.originalName}
          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
          style={{ maxHeight: height }}
        />
      </div>
    );
  }

  // Office Documents (Word, PowerPoint, Excel)
  if (isOffice(doc.mimeType)) {
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
