/** Formatting helpers shared across the app. */

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toFixed(2)}`;
}

export function formatMoneyIN(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', opts);
  } catch {
    return '—';
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN');
  } catch {
    return '—';
  }
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_LABELS = [
  ['pdf', 'PDF'],
  ['wordprocessingml', 'DOCX'],
  ['msword', 'DOC'],
  ['presentationml', 'PPTX'],
  ['ms-powerpoint', 'PPT'],
  ['spreadsheetml', 'XLSX'],
  ['ms-excel', 'XLS'],
  ['text/plain', 'TXT'],
  ['image/png', 'PNG'],
  ['image/jpeg', 'JPG'],
  ['image/webp', 'WEBP'],
  ['image/gif', 'GIF'],
  ['image/svg', 'SVG'],
];

export function fileTypeLabel(mimeType = '') {
  const m = String(mimeType).toLowerCase();
  const hit = MIME_LABELS.find(([key]) => m.includes(key));
  return hit ? hit[1] : 'FILE';
}

/** Accent color + background for a file's type chip (mirrors legacy palette). */
export function fileTypeColors(mimeType = '') {
  const label = fileTypeLabel(mimeType).toLowerCase();
  if (label === 'pdf') return { color: '#DC2626', bg: '#FEF2F2' };
  if (label === 'doc' || label === 'docx') return { color: '#2563EB', bg: '#EBF3FE' };
  if (label === 'ppt' || label === 'pptx') return { color: '#EA580C', bg: '#FFF6ED' };
  if (label === 'xls' || label === 'xlsx') return { color: '#059669', bg: '#ECFDF3' };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(label))
    return { color: '#16A34A', bg: '#ECFDF3' };
  if (label === 'txt') return { color: '#0284C7', bg: '#F0F9FF' };
  return { color: '#7A7791', bg: '#EEF0FF' };
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function initials(name) {
  if (!name) return 'U';
  return name.trim().charAt(0).toUpperCase();
}
