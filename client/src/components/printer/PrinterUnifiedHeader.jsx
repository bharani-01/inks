import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  ChevronDown,
  Sliders,
  RotateCcw,
  Check,
  X,
  Type,
  LayoutGrid,
  Sun,
  Maximize2,
  Minus,
  Plus,
  Menu,
  QrCode,
  User as UserIcon,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import Logo from '../Logo.jsx';
import NotificationBell from '../NotificationBell.jsx';
import { initials } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePrinterAccessibility } from '../../context/PrinterAccessibilityContext.jsx';

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
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 px-3 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
      >
        <div className="flex flex-col items-start leading-none min-w-0">
          <span className="text-xs font-bold text-slate-900 truncate max-w-[8.5rem]">{user?.name || 'Printer Admin'}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">Printer Admin</span>
        </div>
        <ChevronDown size={12} className="text-slate-400 shrink-0 ml-0.5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 card p-1.5 shadow-pop z-50 animate-scale-in origin-top-right bg-white border border-line">
          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-xs font-semibold text-ink truncate">{user?.name}</p>
            <p className="text-[11px] text-ink-muted truncate">{user?.email}</p>
          </div>
          <Link
            to="/user/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 h-9 rounded-lg text-xs font-medium text-ink-soft hover:bg-paper-hover hover:text-ink transition-colors"
          >
            <UserIcon size={16} /> Profile &amp; Settings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 h-9 rounded-lg text-xs font-medium text-danger hover:bg-danger-soft cursor-pointer transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function PrinterUnifiedHeader({ collapsed, toggleSidebar, onOpenScanModal }) {
  const { user, logout } = useAuth();
  const {
    settings,
    updateSettings,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    resetAllSettings,
    optionsModalOpen,
    setOptionsModalOpen,
    t,
    SUPPORTED_LANGUAGES,
  } = usePrinterAccessibility();

  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [coverDropdownOpen, setCoverDropdownOpen] = useState(false);
  const langRef = useRef(null);
  const coverRef = useRef(null);
  const optionsRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
      if (coverRef.current && !coverRef.current.contains(e.target)) {
        setCoverDropdownOpen(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setOptionsModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setOptionsModalOpen]);

  const FONT_PRESETS = [80, 90, 100, 115, 130, 150, 175, 200];
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === settings.language) || SUPPORTED_LANGUAGES[0];

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-line z-50 flex items-center justify-between px-3 sm:px-5 lg:px-6 shadow-2xs select-none"
      role="banner"
      style={{ fontSize: '13px' }}
    >
      {/* 1. Left Section: Logo & Sidebar Toggle / Quick Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Mobile or Collapsed Logo */}
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded-full uppercase tracking-wider hidden sm:inline">
            Printer
          </span>
        </div>

        {/* Desktop Sidebar Toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white hover:bg-paper-hover text-ink-soft hover:text-ink transition-all hover:border-teal-600 cursor-pointer shadow-2xs ml-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={16} strokeWidth={2.2} />
        </button>

        {/* Scan Order QR Button */}
        <button
          type="button"
          onClick={onOpenScanModal}
          className="flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-full border border-teal-200 bg-teal-50/80 hover:bg-teal-100/80 text-teal-800 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          title="Scan printed document QR code"
        >
          <QrCode size={14} className="text-teal-700" />
          <span className="hidden sm:inline">{t('scanQr')}</span>
        </button>
      </div>

      {/* 2. Right Section: Accessibility Steppers + Popover + Language + Notifications + User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Accessibility Stepper Controls (A- | [A] | A+) */}
        <div
          aria-label="Text size controls"
          className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full border border-slate-200/80 shrink-0 shadow-2xs"
          role="group"
        >
          <button
            type="button"
            onClick={decreaseFontSize}
            aria-label="Decrease text size"
            title="Decrease text size (A-)"
            className="h-6 px-2 min-w-[24px] rounded-full hover:bg-white hover:shadow-2xs font-extrabold text-[11px] text-slate-700 transition-all cursor-pointer flex items-center justify-center"
          >
            A-
          </button>

          <button
            type="button"
            onClick={resetFontSize}
            aria-label="Reset text size"
            title={`Reset text size (Currently: ${settings.fontScale || 100}%)`}
            className="h-6 w-6 rounded-full bg-indigo-600 shadow-2xs text-white font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center"
          >
            A
          </button>

          <button
            type="button"
            onClick={increaseFontSize}
            aria-label="Increase text size"
            title="Increase text size (A+)"
            className="h-6 px-2 min-w-[24px] rounded-full hover:bg-white hover:shadow-2xs font-extrabold text-[11px] text-slate-700 transition-all cursor-pointer flex items-center justify-center"
          >
            A+
          </button>
        </div>

        {/* Accessibility Options Popover Button */}
        <div className="relative shrink-0" ref={optionsRef}>
          <button
            type="button"
            onClick={() => setOptionsModalOpen(!optionsModalOpen)}
            aria-label="Accessibility options"
            aria-expanded={optionsModalOpen}
            title="Accessibility & Station Display Options"
            className={`h-8 w-8 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
              optionsModalOpen || settings.highContrast || settings.density !== 'comfortable'
                ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-xs'
                : 'border-slate-200/80 bg-white hover:bg-slate-100 text-slate-700'
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="4.5" r="2.2" fill="currentColor" />
              <path d="M4 8.5h16" />
              <path d="M12 9v7.5" />
              <path d="m8.5 21 3.5-5 3.5 5" />
            </svg>
          </button>

          {/* Floating Accessibility Popover Dropdown */}
          {optionsModalOpen && (
            <div
              className="fixed sm:absolute right-2 sm:right-0 top-15 sm:top-10.5 w-[calc(100vw-16px)] sm:w-[440px] max-w-[440px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-line p-3.5 sm:p-4 z-[100] animate-scale-in origin-top-right space-y-3"
              style={{ maxHeight: '85vh', overflowY: 'auto' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Sliders size={15} />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      {t('displayOptionsTitle')}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={resetAllSettings}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md border border-line hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={11} /> {t('resetDefaults')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptionsModalOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* 1. Font Size Scaling Presets */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Type size={13} className="text-teal-700" /> {t('fontSize')}
                  </span>
                  <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    {settings.fontScale || 100}%
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {FONT_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateSettings({ fontScale: p })}
                      className={`px-2 py-0.5 text-[11px] rounded-md font-semibold transition-all cursor-pointer ${
                        (settings.fontScale || 100) === p
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={decreaseFontSize}
                    className="h-6.5 w-6.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                    title="Decrease scale"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="range"
                    min="70"
                    max="220"
                    step="5"
                    value={settings.fontScale || 100}
                    onChange={(e) => updateSettings({ fontScale: Number(e.target.value) })}
                    className="flex-1 accent-teal-600 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={increaseFontSize}
                    className="h-6.5 w-6.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                    title="Increase scale"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* 2. Layout Density */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <LayoutGrid size={13} className="text-teal-700" /> {t('tableSpacing')}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">{t(settings.density)}</span>
                </div>

                <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => updateSettings({ density: 'compact' })}
                    className={`py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      settings.density === 'compact'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('compact')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ density: 'comfortable' })}
                    className={`py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      settings.density === 'comfortable'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('normal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ density: 'spacious' })}
                    className={`py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      settings.density === 'spacious'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('spacious')}
                  </button>
                </div>
              </div>

              {/* 3. Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5">
                    <Sun size={13} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{t('highContrast')}</p>
                      <p className="text-[10px] text-slate-500">{t('highContrastDesc')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.highContrast}
                    onClick={() => updateSettings({ highContrast: !settings.highContrast })}
                    className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer shrink-0 ml-2 ${
                      settings.highContrast ? 'bg-teal-700' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white block shadow-xs transition-transform absolute top-0.5 ${
                        settings.highContrast ? 'translate-x-4.5 left-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-teal-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{t('boldNumerals')}</p>
                      <p className="text-[10px] text-slate-500">{t('boldNumeralsDesc')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.largeNumerals}
                    onClick={() => updateSettings({ largeNumerals: !settings.largeNumerals })}
                    className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer shrink-0 ml-2 ${
                      settings.largeNumerals ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white block shadow-xs transition-transform absolute top-0.5 ${
                        settings.largeNumerals ? 'translate-x-4.5 left-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>



        {/* Language Selector Dropdown Pill */}
        <div className="relative shrink-0" ref={langRef}>
          <button
            type="button"
            aria-expanded={langDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Globe size={14} className="text-indigo-600 shrink-0" />
            <span className="max-w-[50px] sm:max-w-none truncate">{currentLang.nativeName}</span>
            <ChevronDown
              size={12}
              className={`opacity-70 transition-transform shrink-0 ${langDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-40 sm:w-44 bg-white text-slate-900 rounded-2xl shadow-xl border border-line py-1.5 z-50 animate-scale-in origin-top-right text-xs">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    updateSettings({ language: lang.code });
                    setLangDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer ${
                    settings.language === lang.code ? 'font-bold text-indigo-600 bg-indigo-50/60' : 'text-slate-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{lang.nativeName}</span>
                    <span className="text-[10px] text-slate-400">{lang.name}</span>
                  </div>
                  {settings.language === lang.code && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <span className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

        {/* Notifications Bell */}
        <NotificationBell />

        {/* User Profile Menu Pill */}
        <UserMenu user={user} onLogout={logout} />
      </div>
    </header>
  );
}
