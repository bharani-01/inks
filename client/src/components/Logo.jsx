import { Link } from 'react-router-dom';

/**
 * Brand wordmark: "Inks" (display) + "by Trackify" subtitle.
 * `stacked` renders the subtitle beneath (sidebar); default is inline.
 */
export default function Logo({ to = '/', stacked = false, className = '', onClick }) {
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
