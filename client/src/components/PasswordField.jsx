import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Password input with a show/hide toggle and optional inline error. */
export default function PasswordField({
  label,
  error,
  className = '',
  id,
  name,
  autoComplete = 'current-password',
  ...props
}) {
  const autoId = useId();
  const fieldId = id || name || autoId;
  const errorId = `${fieldId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="field-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={`field-input pr-11 ${error ? 'is-error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center
                     justify-center text-ink-muted hover:text-ink rounded-lg transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
