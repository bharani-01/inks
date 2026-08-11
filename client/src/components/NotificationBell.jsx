import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import {
  Bell,
  Check,
  CheckCheck,
  Package,
  UserCheck,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
} from 'lucide-react';

const TYPE_ICONS = {
  ORDER: <Package size={15} className="text-blue-600" />,
  APPROVAL: <UserCheck size={15} className="text-green-600" />,
  SECURITY: <ShieldAlert size={15} className="text-amber-600" />,
  INFO: <Info size={15} className="text-accent" />,
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      // Quiet fail if not logged in
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 45s
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleMarkAsRead = async (id, link) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (link) {
        setOpen(false);
        const targetLink = user?.role === 'PRINTER_ADMIN' && link.startsWith('/admin/')
          ? link.replace(/^\/admin\//, '/printer/')
          : link;
        navigate(targetLink);
      }
    } catch (err) {
      // Quiet fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      // Quiet fail
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchNotifications();
        }}
        className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-line bg-white text-ink-soft hover:bg-paper-hover transition-colors relative"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white animate-scale-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 card shadow-pop z-50 animate-scale-in origin-top-right overflow-hidden bg-white">
          {/* Header */}
          <div className="p-3.5 border-b border-line flex items-center justify-between bg-paper-hover/50">
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-sm text-ink">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-soft text-accent">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
              >
                <CheckCheck size={13} /> Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <Bell size={24} className="mx-auto text-ink-muted/40 mb-2" />
                <p className="text-xs font-semibold text-ink">All caught up!</p>
                <p className="text-[11px] text-ink-muted">No new alerts or order updates right now.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id, n.link)}
                  className={`p-3 text-xs transition-colors cursor-pointer flex items-start gap-2.5 ${
                    !n.isRead ? 'bg-accent-soft/30 hover:bg-accent-soft/50' : 'hover:bg-paper-hover/60'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-paper-sunken shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] || <Info size={14} className="text-ink-muted" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <p className={`font-semibold truncate ${!n.isRead ? 'text-ink' : 'text-ink-soft'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-ink-muted shrink-0">
                        {formatDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-ink-muted mt-0.5 line-clamp-2 leading-relaxed text-[11px]">
                      {n.message}
                    </p>
                  </div>

                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-accent shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
