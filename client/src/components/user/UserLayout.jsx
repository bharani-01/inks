import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid,
  Package,
  FileText,
  LifeBuoy,
  LogOut,
  Bell,
  ChevronDown,
  User as UserIcon,
  Wallet,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials, formatMoneyIN } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import Logo from '../Logo.jsx';
import NotificationBell from '../NotificationBell.jsx';

const NAV = [
  { to: '/user/print', label: 'Print Hub', icon: LayoutGrid, end: false },
  { to: '/user/orders', label: 'My Orders', icon: Package },
  { to: '/user/documents', label: 'My Documents', icon: FileText },
  { to: '/user/wallet', label: 'Ink Wallet', icon: Wallet },
  { to: '/user/support', label: 'Support', icon: LifeBuoy },
];

function NavItems({ onNavigate, collapsed }) {
  return (
    <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto" aria-label="User navigation">
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
                ? 'bg-accent text-white shadow-sm font-semibold'
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

/** User chip with a small dropdown (Profile / Sign out). */
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

  const roleLabel = user?.role === 'ADMIN' ? 'Administrator' : 'Customer';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 h-11 pl-1.5 pr-2.5 rounded-full border border-line bg-white hover:bg-paper-hover transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="h-8 w-8 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center text-sm font-semibold">
          {initials(user?.name)}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight min-w-0">
          <span className="text-sm font-semibold text-ink truncate max-w-[8rem]">{user?.name || 'User'}</span>
          <span className="text-xs text-ink-muted">{roleLabel}</span>
        </span>
        <ChevronDown size={16} className="text-ink-muted shrink-0" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-52 card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
          </div>
          <Link
            to="/user/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover hover:text-ink"
            role="menuitem"
          >
            <UserIcon size={16} /> Profile &amp; Settings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 w-full px-3 h-9 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft"
            role="menuitem"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Mobile navigation — the avatar in the top bar opens a single dropdown holding
 * both the section links and the account actions (replaces the slide-out drawer).
 */
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
        aria-label="Open menu"
      >
        <span className="h-8 w-8 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center text-sm font-semibold">
          {initials(user?.name)}
        </span>
        <ChevronDown
          size={16}
          className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right"
          role="menu"
        >
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <p className="text-sm font-semibold text-ink truncate">{user?.name || 'User'}</p>
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
              role="menuitem"
            >
              <Icon size={18} aria-hidden="true" /> {label}
            </NavLink>
          ))}
          <div className="my-1 border-t border-line" />
          <Link
            to="/user/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper-hover hover:text-ink"
            role="menuitem"
          >
            <UserIcon size={18} /> Profile &amp; Settings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 h-10 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft"
            role="menuitem"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Header Pill for Ink Wallet live balance */
function WalletPill() {
  const [balance, setBalance] = useState(() => {
    try {
      const cached = localStorage.getItem('ink_wallet_balance');
      return cached !== null ? parseFloat(cached) : null;
    } catch {
      return null;
    }
  });
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    api
      .get('/wallet')
      .then((res) => {
        if (mounted && res?.wallet) {
          setBalance(res.wallet.balance);
          try {
            localStorage.setItem('ink_wallet_balance', String(res.wallet.balance));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  return (
    <Link
      to="/user/wallet"
      className="flex items-center gap-2 h-10 px-3.5 rounded-full border border-line bg-white hover:bg-paper-hover hover:border-accent text-xs font-semibold text-ink shadow-xs transition-all group"
      title="View Ink Wallet Balance & Transactions"
    >
      <div className="h-6 w-6 rounded-full bg-accent-soft text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
        <Wallet size={13} />
      </div>
      <span className="font-mono text-xs font-bold text-ink">
        {balance !== null ? formatMoneyIN(balance) : '₹ ...'}
      </span>
    </Link>
  );
}

export default function UserLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Collapsible sidebar state with localStorage persistence
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('printa_user_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('printa_user_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-paper [overflow-x:clip]">
      {/* Mobile top bar — tap the avatar for nav + account options */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white/90 backdrop-blur border-b border-line">
        <Logo />
        <div className="flex items-center gap-2">
          <WalletPill />
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
            collapsed ? 'justify-center' : 'px-5'
          }`}
        >
          {collapsed ? <Logo iconOnly /> : <Logo />}
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
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-line bg-white hover:bg-paper-hover text-ink-soft hover:text-ink shadow-2xs transition-all hover:border-accent"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu size={18} strokeWidth={2.2} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <WalletPill />
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
    </div>
  );
}
