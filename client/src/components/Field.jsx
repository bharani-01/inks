import { useId } from 'react';

/** Labeled input with optional inline error message. */
export default function Field({
  label,
  error,
  hint,
  optional = false,
  className = '',
  as = 'input',
  children,
  id,
  name,
  ...props
}) {
  const autoId = useId();
  const fieldId = id || name || autoId;
  const errorId = `${fieldId}-error`;
  const Tag = as;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="field-label">
          {label}
          {optional && <span className="text-ink-faint font-normal"> (optional)</span>}
        </label>
      )}
      <Tag
        id={fieldId}
        className={`field-input ${error ? 'is-error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {children}
      </Tag>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger font-medium">
          {error}
        </p>
      )}
      {!error && hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
