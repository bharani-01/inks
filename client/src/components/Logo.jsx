import { Link } from 'react-router-dom';

/**
 * Brand wordmark: "Inks" (display) + "by Trackify" subtitle.
 * `stacked` renders the subtitle beneath (sidebar); default is inline.
 * `iconOnly` renders compact brand mark for collapsed sidebars.
 */
export default function Logo({ to = '/', stacked = false, iconOnly = false, className = '', onClick }) {
  if (iconOnly) {
    const iconMark = (
      <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-accent text-white flex items-center justify-center font-display font-extrabold text-base shadow-sm shrink-0 select-none">
        i
      </span>
    );
    if (to) {
      return (
        <Link to={to} className={`inline-flex items-center justify-center ${className}`} onClick={onClick} aria-label="Inks — home">
          {iconMark}
        </Link>
      );
    }
    return <span className={`inline-flex items-center justify-center ${className}`}>{iconMark}</span>;
  }

  const inner = stacked ? (
    <span className="flex flex-col leading-none">
      <span className="font-display font-bold text-xl tracking-tight text-ink">Inks</span>
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-ink-muted mt-0.5">
        by Trackify
      </span>
    </span>
  ) : (
    <span className="flex items-baseline gap-1.5">
      <span className="font-display font-bold text-xl tracking-tight text-ink">Inks</span>
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">
        by Trackify
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className={`inline-flex ${className}`} onClick={onClick} aria-label="Inks by Trackify — home">
        {inner}
      </Link>
    );
  }
  return <span className={`inline-flex ${className}`}>{inner}</span>;
}
