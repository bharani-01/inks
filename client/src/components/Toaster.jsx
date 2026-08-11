import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 text-emerald-600 ring-emerald-500/20 shadow-xs shadow-emerald-500/10',
    barBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
  error: {
    icon: AlertCircle,
    badgeBg: 'bg-rose-50 text-rose-600 ring-rose-500/20 shadow-xs shadow-rose-500/10',
    barBg: 'bg-gradient-to-r from-rose-500 to-red-500',
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: 'bg-amber-50 text-amber-600 ring-amber-500/20 shadow-xs shadow-amber-500/10',
    barBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  info: {
    icon: Info,
    badgeBg: 'bg-indigo-50 text-indigo-600 ring-indigo-500/20 shadow-xs shadow-indigo-500/10',
    barBg: 'bg-gradient-to-r from-indigo-500 to-sky-500',
  },
};

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 3500;

  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(duration);
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Swipe-to-dismiss touch tracking
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 220);
  }, [onDismiss, toast.id]);

  // Handle countdown & progress bar with pause-on-hover
  useEffect(() => {
    if (duration <= 0) return;

    const startTimer = () => {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(handleDismiss, remainingRef.current);

      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentRemaining = Math.max(0, remainingRef.current - elapsed);
        const p = (currentRemaining / duration) * 100;
        setProgress(p);

        if (currentRemaining > 0 && !isPaused) {
          animFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animFrameRef.current = requestAnimationFrame(updateProgress);
    };

    if (!isPaused) {
      startTimer();
    } else {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPaused, duration, handleDismiss]);

  const onMouseEnter = () => {
    if (duration <= 0) return;
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    setIsPaused(true);
  };

  const onMouseLeave = () => {
    if (duration <= 0) return;
    setIsPaused(false);
  };

  // Touch gesture handlers for mobile flick-to-dismiss
  const onTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const onTouchMove = (e) => {
    const diffY = e.touches[0].clientY - touchStartY.current;
    const diffX = e.touches[0].clientX - touchStartX.current;
    if (diffY < 0 || Math.abs(diffX) > 20) {
      setDragOffset({ x: diffX * 0.4, y: Math.min(0, diffY) });
    }
  };

  const onTouchEnd = () => {
    setIsPaused(false);
    if (dragOffset.y < -35 || Math.abs(dragOffset.x) > 60) {
      handleDismiss();
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const v = VARIANTS[toast.type] || VARIANTS.info;
  const Icon = v.icon;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
        opacity: Math.max(0.2, 1 - Math.abs(dragOffset.y) / 80 - Math.abs(dragOffset.x) / 120),
      }}
      role="alert"
      className={`group relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_14px_38px_-8px_rgba(15,23,42,0.18),0_4px_14px_-2px_rgba(15,23,42,0.08)] transition-all duration-200 ${
        exiting
          ? 'opacity-0 scale-95 -translate-y-3'
          : 'scale-100 animate-fade-up'
      }`}
    >
      <div className="flex items-center gap-3.5 p-3.5 sm:py-3.5 sm:px-4">
        {/* Glow Icon Bubble */}
        <div
          className={`shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ring-1 ${v.badgeBg} transition-transform group-hover:scale-105`}
        >
          <Icon size={18} className="stroke-[2.2]" />
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-[13.5px] font-medium text-slate-800 leading-snug tracking-[-0.01em]">
            {toast.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close notification"
        >
          <X size={15} />
        </button>
      </div>

      {/* Sleek bottom countdown progress line */}
      {duration > 0 && (
        <div className="h-[2px] w-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${v.barBg} transition-[width] duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const lastToastRef = useRef({ msg: '', time: 0 });

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = 'success', duration = 3500) => {
      // Smart de-duplication: prevent duplicate toasts within 1.5s
      const now = Date.now();
      if (lastToastRef.current.msg === message && now - lastToastRef.current.time < 1500) {
        return;
      }
      lastToastRef.current = { msg: message, time: now };

      const id = ++idRef.current;
      setToasts((list) => {
        // Keep max 3 toasts to avoid cluttering screen
        const trimmed = list.length >= 3 ? list.slice(list.length - 2) : list;
        return [...trimmed, { id, message, type, duration }];
      });
      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Floating Container: Responsive Top-Center on mobile & Top-Right on Desktop */}
      <div
        className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-6 sm:top-5 z-[100] flex flex-col gap-2 pointer-events-none w-auto max-w-[94vw] sm:max-w-sm sm:w-full mx-auto"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return () => {};
  }
  return ctx;
}
