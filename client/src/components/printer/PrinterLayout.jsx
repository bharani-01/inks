import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Printer,
  QrCode,
} from 'lucide-react';
import ScanQrModal from '../ScanQrModal.jsx';
import PrinterUnifiedHeader from './PrinterUnifiedHeader.jsx';
import { PrinterAccessibilityProvider, usePrinterAccessibility } from '../../context/PrinterAccessibilityContext.jsx';

const NAV = [
  { to: '/printer/dashboard', label: 'Print Dashboard', icon: LayoutDashboard },
  { to: '/printer/orders', label: 'Print Queue', icon: Printer },
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

function PrinterLayoutInner() {
  const location = useLocation();
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const { settings, t } = usePrinterAccessibility();

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

  const scaleRatio = settings.fontScale ? settings.fontScale / 100 : 1;

  return (
    <div className="min-h-screen bg-paper flex flex-col w-full">
      {/* 1. Unified Fixed Single-Line Top Header (Both Navigation + Accessibility Controls) */}
      <PrinterUnifiedHeader
        collapsed={collapsed}
        toggleSidebar={toggleSidebar}
        onOpenScanModal={() => setScanModalOpen(true)}
      />

      {/* 2. Desktop Fixed Sidebar (Permanently pinned on the left below top header) */}
      <aside
        className={`hidden lg:flex fixed left-0 top-14 bottom-0 z-40 bg-white border-r border-line flex-col transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <NavItems collapsed={collapsed} />
      </aside>

      {/* 3. Main Content Column with matching smooth responsive margins */}
      <div
        className={`flex-1 flex flex-col min-h-[calc(100vh-56px)] mt-14 transition-all duration-300 ease-in-out pb-16 lg:pb-0 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {/* Main Workstation Workspace */}
        <main
          className="flex-1 transition-all duration-150 w-full"
          id="main-content"
          style={{
            zoom: scaleRatio,
          }}
        >
          <div className="w-full px-3 sm:px-4 lg:px-6 py-3.5 sm:py-4" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* 4. Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-line px-3 py-1.5 flex items-center justify-around shadow-lg"
      >
        <NavLink
          to="/printer/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
              isActive ? 'text-teal-700 font-bold' : 'text-ink-soft hover:text-ink'
            }`
          }
        >
          <LayoutDashboard size={18} />
          <span className="mt-0.5">{t('dashboard')}</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setScanModalOpen(true)}
          className="flex flex-col items-center -mt-4 bg-teal-600 text-white rounded-full p-2.5 shadow-md hover:bg-teal-700 transition-colors cursor-pointer"
          title="Scan QR Code"
        >
          <QrCode size={20} />
        </button>

        <NavLink
          to="/printer/orders"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
              isActive ? 'text-teal-700 font-bold' : 'text-ink-soft hover:text-ink'
            }`
          }
        >
          <Printer size={18} />
          <span className="mt-0.5">{t('printQueue')}</span>
        </NavLink>
      </nav>

      <ScanQrModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
      />
    </div>
  );
}

export default function PrinterLayout() {
  return (
    <PrinterAccessibilityProvider>
      <PrinterLayoutInner />
    </PrinterAccessibilityProvider>
  );
}
