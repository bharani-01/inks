import { Link } from 'react-router-dom';

/**
 * Official Brand Logo Component: Inks By Trackify
 * Prominently sized logo rendered using official cropped inks_logo.webp
 */
export default function Logo({ to = '/', stacked = false, iconOnly = false, height = '46px', className = '', onClick }) {
  if (iconOnly) {
    const iconMark = (
      <span className="h-10 w-10 rounded-xl bg-white border border-line p-1 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 select-none">
        <img
          src="/inks_logo.webp"
          alt="Inks logo mark"
          className="h-full w-full object-contain"
        />
      </span>
    );
    if (to) {
      return (
        <Link to={to} className={`inline-flex items-center justify-center ${className}`} onClick={onClick} aria-label="Inks by Trackify — home">
          {iconMark}
        </Link>
      );
    }
    return <span className={`inline-flex items-center justify-center ${className}`}>{iconMark}</span>;
  }

  const inner = (
    <img
      src="/inks_logo.webp"
      alt="Inks by Trackify"
      className="object-contain max-w-full transition-all"
      style={{ height: height || '46px', width: 'auto' }}
    />
  );

  if (to) {
    return (
      <Link to={to} className={`inline-flex items-center ${className}`} onClick={onClick} aria-label="Inks by Trackify — home">
        {inner}
      </Link>
    );
  }
  return <span className={`inline-flex items-center ${className}`}>{inner}</span>;
}
