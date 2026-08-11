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
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
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

function NavItems({ onNavigate, collapsed }) {
  return (
    <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto" aria-label="Printer admin navigation">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            `flex items-center rounded-xl text-sm font-medium transition-all group relative ${
              collapsed
                ? 'justify-center h-11 w-11 mx-auto'
                : 'gap-3 px-3.5 h-11 w-full'
            } ${
              isActive
                ? 'bg-teal-600 text-white shadow-sm font-semibold'
                : 'text-ink-soft hover:bg-paper-hover hover:text-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={19} className="shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{label}</span>}

              {/* Tooltip on hover when collapsed */}
              {collapsed && (
                <span className="fixed left-20 ml-2 px-2.5 py-1.5 bg-ink text-white text-xs font-semibold rounded-lg shadow-pop pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  {label}
                </span>
              )}
            </>
          )}
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
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="h-8 w-8 rounded-full bg-teal-600 text-white inline-flex items-center justify-center text-sm font-semibold shadow-sm">
          {initials(user?.name)}
        </span>
        <ChevronDown
          size={16}
          className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right">
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{user?.name || 'Printer Admin'}</p>
            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
          </div>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold'
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

  // Collapsible sidebar state with localStorage persistence
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('printa_printer_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('printa_printer_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-paper [overflow-x:clip]">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white/90 backdrop-blur border-b border-line">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScanModalOpen(true)}
            className="h-10 w-10 flex items-center justify-center rounded-full border border-line bg-white text-teal-600 hover:bg-paper-hover"
            title="Scan Order QR Code"
          >
            <QrCode size={18} />
          </button>
          <MobileMenu user={user} onLogout={logout} />
        </div>
      </header>

      {/* Desktop sidebar with smooth collapse/expand */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-50 bg-white border-r border-line flex-col transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Brand */}
        <div
          className={`flex items-center h-16 border-b border-line shrink-0 px-4 transition-all duration-300 ${
            collapsed ? 'justify-center' : 'px-5 justify-between'
          }`}
        >
          {collapsed ? (
            <Logo iconOnly />
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <Logo />
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Printer
              </span>
            </div>
          )}
        </div>

        <NavItems collapsed={collapsed} />
      </aside>

      {/* Main column with matching smooth margin transition */}
      <div
        className={`min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {/* Desktop top header */}
        <header className="hidden lg:flex items-center justify-between gap-3 h-16 px-8 bg-white border-b border-line sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 rounded-xl border border-line text-ink-soft hover:text-ink hover:bg-paper-hover transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            <button
              type="button"
              onClick={() => setScanModalOpen(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-full border border-line bg-white hover:bg-paper-hover text-ink text-xs font-semibold shadow-xs transition-all hover:border-teal-600"
              title="Scan printed document QR code to verify or mark delivered"
            >
              <QrCode size={16} className="text-teal-600" />
              <span>Scan Order QR</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu user={user} onLogout={logout} />
          </div>
        </header>

        <main className="flex-1">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8" key={location.pathname}>
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
