/**
 * Creative document-upload animation (no emoji, pure CSS + SVG).
 *
 * A sheet of "paper" with faint text lines. As `percent` climbs, an indigo ink
 * fill rises from the bottom, revealing the lines it passes; a scanner beam
 * sweeps up and down the page the whole time. At 100% the beam stops and a
 * check confirms completion. Everything is gated behind prefers-reduced-motion
 * globally (see index.css), so the sweep/shimmer freeze for those users while
 * the fill still reflects real progress.
 */
import { Check, FileText } from 'lucide-react';

// Widths (%) for the faux text lines, so the page looks like a real document.
const LINES = [92, 78, 85, 64, 88, 72, 90, 58];

export default function DocumentScanAnimation({ percent = 0, fileName }) {
  const done = percent >= 100;

  return (
    <div className="flex flex-col items-center">
      {/* The page being scanned */}
      <div className="relative w-28 h-36 sm:w-32 sm:h-40" aria-hidden="true">
        {/* Back sheet for a subtle stacked-paper depth */}
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg bg-accent-soft/60 rotate-3" />

        {/* Front sheet */}
        <div className="absolute inset-0 rounded-lg bg-white border border-line shadow-card overflow-hidden">
          {/* Faux document lines */}
          <div className="absolute inset-0 px-3 py-3.5 flex flex-col gap-[7px]">
            <span className="h-2 w-1/2 rounded-full bg-ink/15 mb-1" />
            {LINES.map((w, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full bg-ink/10"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>

          {/* Ink fill rising from the bottom as progress advances */}
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-accent to-accent/70 transition-[height] duration-300 ease-out"
            style={{ height: `${Math.min(100, percent)}%` }}
          >
            {/* Re-drawn lines in white so they "develop" as the ink passes over them */}
            <div className="absolute inset-x-0 bottom-0 h-36 sm:h-40 px-3 py-3.5 flex flex-col gap-[7px] justify-start">
              <span className="h-2 w-1/2 rounded-full bg-white/70 mb-1" />
              {LINES.map((w, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full bg-white/55"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>

          {/* Scanner beam sweeping the page (hidden once complete) */}
          {!done && (
            <div className="absolute inset-x-0 animate-scan-y" style={{ top: '8%' }}>
              <div className="h-0.5 w-full bg-accent shadow-[0_0_10px_2px_rgba(67,56,202,0.55)]" />
              <div className="h-6 w-full bg-gradient-to-b from-accent/25 to-transparent" />
            </div>
          )}
        </div>

        {/* Completion badge */}
        {done && (
          <span className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-success text-white inline-flex items-center justify-center shadow-card animate-scale-in">
            <Check size={17} strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Status line */}
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
        <FileText size={15} className="text-accent shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[16rem]">
          {done ? 'Processing complete' : `Scanning ${fileName || 'document'}…`}
        </span>
      </div>
    </div>
  );
}
