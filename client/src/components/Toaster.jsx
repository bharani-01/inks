import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircle2, accent: 'text-success', border: 'border-l-success' },
  error: { icon: XCircle, accent: 'text-danger', border: 'border-l-danger' },
  warning: { icon: AlertTriangle, accent: 'text-warning', border: 'border-l-warning' },
  info: { icon: Info, accent: 'text-info', border: 'border-l-info' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = 'success', duration = 4000) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const v = VARIANTS[t.type] || VARIANTS.info;
          const Icon = v.icon;
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 bg-white rounded-xl shadow-pop border border-line
                          border-l-4 ${v.border} p-3.5 animate-slide-in-right`}
              role="alert"
            >
              <Icon size={18} className={`${v.accent} mt-0.5 shrink-0`} aria-hidden="true" />
              <p className="text-sm text-ink flex-1 leading-snug">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-ink-faint hover:text-ink transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so calls never crash outside the provider.
    return () => {};
  }
  return ctx;
}
