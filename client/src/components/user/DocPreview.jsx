import { ShieldAlert, FileCheck2 } from 'lucide-react';
import { previewUrl, getToken, API_BASE } from '../../lib/api.js';
import { formatFileSize } from '../../lib/format.js';
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
    s.includes('vnd.ms-powerpoint')
  );
};

/**
 * Live document preview. Mirrors the legacy renderLivePreview():
 * PDF → iframe, image → contained img, Office → production Office viewer
 * (with a localhost notice), everything else → a "ready" placeholder.
 * A grayscale filter is applied when B&W is selected.
 */
export default function DocPreview({ doc, grayscale, onReupload }) {
  if (!doc) return null;

  const autoDeleted = doc.filePath && String(doc.filePath).startsWith('[AUTO_DELETED]');

  if (autoDeleted) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/5 p-8 text-center">
        <div className="h-12 w-12 mx-auto rounded-full bg-warning/15 text-warning inline-flex items-center justify-center">
          <ShieldAlert size={24} />
        </div>
        <h4 className="mt-3 font-display font-semibold text-ink">File purged for privacy (30-min rule)</h4>
        <p className="mt-1 text-sm text-ink-muted max-w-sm mx-auto">
          This file was automatically deleted 30 minutes after its last order, for your privacy.
          Upload a fresh copy to print it again.
        </p>
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onReupload}>
            Upload fresh copy
          </Button>
        </div>
      </div>
    );
  }

  const src = previewUrl(doc.id);
  const filterStyle = grayscale ? { filter: 'grayscale(100%) contrast(115%)' } : undefined;

  if (isPdf(doc.mimeType)) {
    return (
      <div className="rounded-xl overflow-hidden border border-line bg-white" style={filterStyle}>
        <iframe
          src={src}
          title={`Preview of ${doc.originalName}`}
          className="w-full h-[460px] border-0"
        />
      </div>
    );
  }

  if (isImage(doc.mimeType)) {
    return (
      <div
        className="rounded-xl overflow-hidden border border-line bg-ink/95 flex items-center justify-center p-4"
        style={filterStyle}
      >
        <img
          src={src}
          alt={doc.originalName}
          className="max-w-full max-h-[440px] object-contain rounded-lg"
        />
      </div>
    );
  }

  if (isOffice(doc.mimeType)) {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalhost) {
      return (
        <div className="rounded-xl border border-dashed border-accent/40 bg-accent-soft/40 p-10 text-center">
          <FileTypeIcon mimeType={doc.mimeType} size={28} boxed className="mx-auto" />
          <h4 className="mt-3 font-display font-semibold text-ink">Office document preview</h4>
          <p className="mt-1 text-sm text-ink-muted max-w-sm mx-auto">
            A visual preview for Word and PowerPoint files uses the Microsoft Office viewer, which
            needs a public URL. It renders once the app is deployed.
          </p>
          <span className="badge badge-accent mt-3">Works in production</span>
        </div>
      );
    }

    const publicUrl = `${window.location.origin}${API_BASE}/documents/${doc.id}/preview?token=${encodeURIComponent(
      getToken() || ''
    )}`;
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
    return (
      <div className="rounded-xl overflow-hidden border border-line bg-white" style={filterStyle}>
        <iframe src={viewer} title={`Preview of ${doc.originalName}`} className="w-full h-[460px] border-0" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-paper-sunken p-10 text-center" style={filterStyle}>
      <div className="h-12 w-12 mx-auto rounded-full bg-success/10 text-success inline-flex items-center justify-center">
        <FileCheck2 size={24} />
      </div>
      <h4 className="mt-3 font-display font-semibold text-ink break-words">{doc.originalName}</h4>
      <p className="mt-1 text-sm text-ink-muted max-w-sm mx-auto">
        Preview ready ({formatFileSize(doc.fileSize)}). Your selected print options will be applied.
      </p>
      <span className="badge badge-success mt-3">Ready for printing</span>
    </div>
  );
}
