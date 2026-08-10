import { fileTypeColors } from '../lib/format.js';

/**
 * File-type representation — a white document (folded corner) carrying a
 * recognizable, colored per-type motif: Word "W", Excel "X", PowerPoint "P",
 * a red "PDF" tab, a picture glyph for images, and text lines for everything
 * else. When `boxed`, the document sits on a soft tinted tile (the type colour).
 *
 * Props are unchanged (mimeType/size/boxed/className) so every call site works.
 */
function getFamily(mimeType = '') {
  const m = String(mimeType).toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('wordprocessing') || m.includes('msword') || m.includes('word')) return 'word';
  if (m.includes('spreadsheet') || m.includes('excel')) return 'excel';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'ppt';
  if (m.startsWith('image/')) return 'image';
  return 'text';
}

function Motif({ family, color }) {
  const letter = { word: 'W', excel: 'X', ppt: 'P' }[family];
  if (letter) {
    return (
      <text
        x="19.5"
        y="31"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fontFamily="Inter, system-ui, sans-serif"
        fill={color}
      >
        {letter}
      </text>
    );
  }
  if (family === 'pdf') {
    return (
      <>
        <rect x="7.5" y="24" width="24" height="10" rx="2.5" fill={color} />
        <text
          x="19.5"
          y="31.3"
          textAnchor="middle"
          fontSize="6.6"
          fontWeight="800"
          letterSpacing="0.3"
          fontFamily="Inter, system-ui, sans-serif"
          fill="#fff"
        >
          PDF
        </text>
      </>
    );
  }
  if (family === 'image') {
    return (
      <>
        <circle cx="15" cy="20.5" r="2.3" fill={color} />
        <path d="M11 31l6-7 4 4.5 3-2.5 5 5z" fill={color} fillOpacity="0.9" />
      </>
    );
  }
  // text / generic
  return (
    <>
      <rect x="12" y="20" width="16" height="2" rx="1" fill={color} fillOpacity="0.85" />
      <rect x="12" y="25" width="16" height="2" rx="1" fill={color} fillOpacity="0.85" />
      <rect x="12" y="30" width="10" height="2" rx="1" fill={color} fillOpacity="0.85" />
    </>
  );
}

export default function FileTypeIcon({ mimeType = '', size = 20, boxed = false, className = '' }) {
  const family = getFamily(mimeType);
  const { color, bg } = fileTypeColors(mimeType);
  const glyph = boxed ? size + 8 : size;

  const svg = (
    <svg width={glyph} height={glyph} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* Document body with a folded top-right corner */}
      <path
        d="M10.5 3.5H23.5L31 11V34.5A2.5 2.5 0 0 1 28.5 37H10.5A2.5 2.5 0 0 1 8 34.5V6A2.5 2.5 0 0 1 10.5 3.5Z"
        fill="#fff"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path d="M23.5 3.5 31 11H26A2.5 2.5 0 0 1 23.5 8.5Z" fill={color} fillOpacity="0.22" />
      {/* Two faint header lines to read as a document (skipped for the text motif, which draws its own) */}
      {family !== 'text' && family !== 'pdf' && (
        <>
          <rect x="12" y="13" width="12" height="1.8" rx="0.9" fill={color} fillOpacity="0.18" />
          <rect x="12" y="16.5" width="9" height="1.8" rx="0.9" fill={color} fillOpacity="0.18" />
        </>
      )}
      <Motif family={family} color={color} />
    </svg>
  );

  if (!boxed) return <span className={`inline-flex ${className}`}>{svg}</span>;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl shrink-0 ${className}`}
      style={{ width: size + 20, height: size + 20, background: bg }}
      aria-hidden="true"
    >
      {svg}
    </span>
  );
}
