const VARIANT_CLASS = {
  primary: 'btn-primary',
  ink: 'btn-ink',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE_CLASS = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

/**
 * Button primitive. Renders <button> by default, or <a> when `href` is given
 * (used for cross-app links to /admin HTML). Supports a loading spinner.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  loadingText,
  href,
  className = '',
  children,
  disabled,
  ...props
}) {
  const cls = [
    'btn',
    VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
    SIZE_CLASS[size] || '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = loading ? (
    <>
      <span className="spinner" aria-hidden="true" />
      {loadingText || 'Please wait…'}
    </>
  ) : (
    children
  );

  if (href) {
    return (
      <a href={href} className={cls} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}
