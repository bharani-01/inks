import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileText,
  CreditCard,
  LogOut,
  ChevronDown,
  User as UserIcon,
  Printer,
  MessageSquare,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../lib/format.js';
import Logo from '../Logo.jsx';
import NotificationBell from '../NotificationBell.jsx';
import ScanQrModal from '../ScanQrModal.jsx';

const NAV = [
  { to: '/printer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/printer/orders', label: 'Orders', icon: Package },
  { to: '/printer/payments', label: 'Payments & UPI', icon: CreditCard },
  { to: '/printer/documents', label: 'Documents', icon: FileText },
  { to: '/printer/feedback', label: 'Feedback', icon: MessageSquare },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Printer admin navigation">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-teal-50 text-teal-700'
                : 'text-ink-soft hover:bg-paper-hover hover:text-ink'
            }`
          }
        >
          <Icon size={19} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 h-11 pl-1.5 pr-2.5 rounded-full border border-line bg-white hover:bg-paper-hover transition-colors"
      >
        <span className="h-8 w-8 rounded-full bg-teal-600 text-white inline-flex items-center justify-center text-sm font-semibold shadow-sm ring-2 ring-white">
          {initials(user?.name)}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight min-w-0">
          <span className="text-sm font-semibold text-ink truncate max-w-[8rem]">{user?.name}</span>
          <span className="text-xs text-teal-600 font-medium">Printer Admin</span>
        </span>
        <ChevronDown size={16} className="text-ink-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right">
          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
          </div>
          <Link
            to="/printer/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover hover:text-ink"
          >
            <UserIcon size={16} /> Profile &amp; Settings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 w-full px-3 h-9 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MobileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-10 pl-1 pr-2 rounded-full border border-line bg-white hover:bg-paper-hover transition-colors"
      >
        <span className="h-8 w-8 rounded-full bg-teal-600 text-white inline-flex items-center justify-center text-sm font-semibold shadow-sm ring-2 ring-white">
          {initials(user?.name)}
        </span>
        <ChevronDown size={16} className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right">
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{user?.name || 'Printer Admin'}</p>
            <p className="text-xs text-teal-600 font-medium">Printer Admin</p>
          </div>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-ink-soft hover:bg-paper-hover hover:text-ink'
                }`
              }
            >
              <Icon size={18} aria-hidden="true" /> {label}
            </NavLink>
          ))}
          <div className="my-1 border-t border-line" />
          <Link
            to="/printer/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover hover:text-ink"
          >
            <UserIcon size={18} /> Profile &amp; Settings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 h-10 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function PrinterLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [scanModalOpen, setScanModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper [overflow-x:clip]">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="ml-1 text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Printer
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="h-10 w-10 flex items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
            title="Scan Order QR Code"
          >
            <QrCode size={18} />
          </button>
          <MobileMenu user={user} onLogout={logout} />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-line flex-col">
        <div className="flex items-center h-16 px-5 border-b border-line shrink-0">
          <Logo />
          <span className="ml-2 text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Printer
          </span>
        </div>
        <NavItems />

        {/* Footer info */}
        <div className="px-4 pb-4 pt-2 border-t border-line">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-teal-50">
            <span className="h-8 w-8 rounded-full bg-teal-600 text-white inline-flex items-center justify-center text-xs font-bold shrink-0">
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink truncate">{user?.name}</p>
              <p className="text-[11px] text-teal-600 font-medium">Printer Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <header className="hidden lg:flex items-center justify-end gap-3 h-16 px-8 bg-white border-b border-line sticky top-0 z-30">
          <div className="flex items-center gap-2 mr-auto">
            <Printer size={16} className="text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Printer Operations</span>
          </div>
          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-xs transition-all"
            title="Scan printed document QR code to verify or mark delivered"
          >
            <QrCode size={16} className="text-teal-600" />
            <span>Scan Order QR</span>
          </button>
          <NotificationBell />
          <UserMenu user={user} onLogout={logout} />
        </header>

        <main className="flex-1">
          <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <ScanQrModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
      />
    </div>
  );
}
