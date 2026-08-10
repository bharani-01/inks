import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal: backdrop click + Escape close, focus moves in on open,
 * body scroll locked while open. Rendered inline (no portal needed for this app).
 */
export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Only focus the modal panel if focus is outside the modal
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
      panelRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const maxW = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4
                 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`card w-full ${maxW} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-2xl
                    shadow-pop animate-scale-in outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line sticky top-0 bg-white rounded-t-2xl">
            <h2 className="text-lg font-display font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink transition-colors -mr-1"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
