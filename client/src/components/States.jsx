/** Full-area centered loading spinner. */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
      <span className="spinner text-accent text-3xl" aria-hidden="true" />
      <span className="text-sm">{label}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Empty-state block with icon, message, and optional action. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6">
      {Icon && (
        <div className="h-14 w-14 rounded-2xl bg-paper-hover text-ink-muted inline-flex items-center justify-center">
          <Icon size={26} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-display font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-ink-muted max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
