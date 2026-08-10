import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Tag,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../lib/format.js';
import Logo from '../Logo.jsx';
import NotificationBell from '../NotificationBell.jsx';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: Package },
  { to: '/admin/payments', label: 'Payments & UPI', icon: CreditCard },
  { to: '/admin/documents', label: 'Documents', icon: FileText },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/pricing', label: 'Pricing Rules', icon: Settings },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent-soft text-accent'
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
        <span className="h-8 w-8 rounded-full bg-accent text-white inline-flex items-center justify-center text-sm font-semibold shadow-sm ring-2 ring-white">
          {initials(user?.name)}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight min-w-0">
          <span className="text-sm font-semibold text-ink truncate max-w-[8rem]">{user?.name}</span>
          <span className="text-xs text-ink-muted">Administrator</span>
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
            to="/admin/profile"
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
        <span className="h-8 w-8 rounded-full bg-accent text-white inline-flex items-center justify-center text-sm font-semibold shadow-sm ring-2 ring-white">
          {initials(user?.name)}
        </span>
        <ChevronDown size={16} className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right">
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{user?.name || 'Admin'}</p>
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
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-soft hover:bg-paper-hover hover:text-ink'
                }`
              }
            >
              <Icon size={18} aria-hidden="true" /> {label}
            </NavLink>
          ))}
          <div className="my-1 border-t border-line" />
          <Link
            to="/admin/profile"
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

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-paper [overflow-x:clip]">
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white/90 backdrop-blur border-b border-line">
        <Logo />
        <MobileMenu user={user} onLogout={logout} />
      </header>

      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-line flex-col">
        <div className="flex items-center h-16 px-5 border-b border-line shrink-0">
          <Logo />
          <span className="ml-2 text-xs font-semibold text-accent bg-accent-soft px-2 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
        </div>
        <NavItems />
      </aside>

      <div className="lg:ml-64 min-h-screen flex flex-col">
        <header className="hidden lg:flex items-center justify-end gap-3 h-16 px-8 bg-white border-b border-line sticky top-0 z-30">
          <NotificationBell />
          <UserMenu user={user} onLogout={logout} />
        </header>

        <main className="flex-1">
          <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
