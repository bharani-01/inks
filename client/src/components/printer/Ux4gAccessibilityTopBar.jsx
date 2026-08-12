import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { usePrinterAccessibility } from '../../context/PrinterAccessibilityContext.jsx';

export default function Ux4gAccessibilityTopBar() {
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
  const langRef = useRef(null);
  const optionsRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
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
      className="ux4g-topbar ux4g-topbar-wide bg-[#3c229e] text-white font-sans select-none border-b border-[#2e1784] z-50 sticky top-0 shadow-2xs w-full"
      role="banner"
      style={{ fontSize: '13px' }}
    >
      <div className="w-full px-2.5 sm:px-4 lg:px-6">
        <div className="ux4g-topbar__wrap flex items-center justify-between h-9">
          {/* Left: Station Branding (Compact on mobile) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-white font-semibold text-xs tracking-wide truncate max-w-[120px] sm:max-w-none">
              <span className="hidden sm:inline">{t('stationTitle')}</span>
              <span className="sm:hidden">Print Hub</span>
            </span>
          </div>

          {/* Right: Top Utilities & Accessibility Controls */}
          <nav aria-label="Top utilities" className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Skip to Main Content (Visible on focus / Desktop) */}
            <a
              href="#main-content"
              className="ux4g-topbar__skip text-[11px] font-medium text-white/90 hover:text-white underline-offset-2 hover:underline focus:bg-white focus:text-[#3c229e] focus:px-2 focus:py-0.5 focus:rounded transition-all hidden md:inline shrink-0"
            >
              {t('skipToContent')}
            </a>

            {/* Vertical Divider */}
            <span className="h-3.5 w-px bg-white/30 acc-top-divider hidden md:inline shrink-0" aria-hidden="true" />

            {/* Text Size Stepper Controls (A- | [A] | A+) */}
            <div
              aria-label="Text size controls"
              className="ux4g-topbar__group flex items-center gap-0.5 sm:gap-1 shrink-0"
              role="group"
            >
              <button
                type="button"
                onClick={decreaseFontSize}
                aria-label="Decrease text size"
                title="Decrease text size (A-)"
                className="ux4g-topbar__iconbtn h-6 px-1 min-w-[20px] sm:min-w-[24px] rounded hover:bg-white/20 active:bg-white/30 font-bold text-[11px] sm:text-xs text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                A-
              </button>

              <button
                type="button"
                onClick={resetFontSize}
                aria-label="Reset text size"
                title={`Reset text size (Currently: ${settings.fontScale || 100}%)`}
                className="ux4g-topbar__iconbtn h-6 w-5 sm:w-6 rounded border border-white/80 hover:bg-white/20 active:bg-white/30 font-bold text-[11px] sm:text-xs text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                A
              </button>

              <button
                type="button"
                onClick={increaseFontSize}
                aria-label="Increase text size"
                title="Increase text size (A+)"
                className="ux4g-topbar__iconbtn h-6 px-1 min-w-[20px] sm:min-w-[24px] rounded hover:bg-white/20 active:bg-white/30 font-bold text-[11px] sm:text-xs text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                A+
              </button>
            </div>

            {/* Vertical Divider */}
            <span className="h-3.5 w-px bg-white/30 acc-top-divider shrink-0" aria-hidden="true" />

            {/* Accessibility Options Button with Floating Dropdown */}
            <div className="relative shrink-0" ref={optionsRef}>
              <button
                type="button"
                onClick={() => setOptionsModalOpen(!optionsModalOpen)}
                aria-label="Accessibility options"
                aria-expanded={optionsModalOpen}
                title="Accessibility &amp; Station Display Options"
                className={`ux4g-topbar__iconbtn h-6 w-6 sm:h-6.5 sm:w-6.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  optionsModalOpen || settings.highContrast || settings.density !== 'comfortable'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="4.5" r="2.2" fill="currentColor" />
                  <path d="M4 8.5h16" />
                  <path d="M12 9v7.5" />
                  <path d="m8.5 21 3.5-5 3.5 5" />
                </svg>
              </button>

              {/* Floating Accessibility Popover Dropdown (Mobile-Safe) */}
              {optionsModalOpen && (
                <div
                  className="fixed sm:absolute left-2.5 right-2.5 sm:left-auto sm:right-0 top-10.5 sm:top-11 sm:w-[440px] max-w-[440px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-3.5 sm:p-4 z-[100] animate-scale-in origin-top-right space-y-3"
                  style={{ maxHeight: '85vh', overflowY: 'auto' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-lg bg-indigo-50 text-[#3c229e] flex items-center justify-center">
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
                        className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
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
                        <Type size={13} className="text-[#3c229e]" /> {t('fontSize')}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#3c229e] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
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
                              ? 'bg-[#3c229e] text-white shadow-xs'
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
                        className="flex-1 accent-[#3c229e] cursor-pointer"
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
                        <LayoutGrid size={13} className="text-[#3c229e]" /> {t('tableSpacing')}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{t(settings.density)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => updateSettings({ density: 'compact' })}
                        className={`py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                          settings.density === 'compact'
                            ? 'bg-[#3c229e] text-white shadow-xs'
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
                            ? 'bg-[#3c229e] text-white shadow-xs'
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
                            ? 'bg-[#3c229e] text-white shadow-xs'
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
                          settings.highContrast ? 'bg-[#3c229e]' : 'bg-slate-300'
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

            {/* Vertical Divider */}
            <span className="h-3.5 w-px bg-white/30 acc-top-divider shrink-0" aria-hidden="true" />

            {/* Language Selector Dropdown */}
            <div className="ux4g-topbar__select relative shrink-0" ref={langRef}>
              <button
                type="button"
                aria-expanded={langDropdownOpen}
                aria-haspopup="listbox"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="ux4g-topbar__selectbtn flex items-center gap-1 h-6 px-1.5 sm:px-2 rounded hover:bg-white/20 transition-colors text-white font-medium text-[11px] sm:text-xs cursor-pointer"
              >
                <Globe size={12} className="opacity-90 shrink-0" />
                <span className="max-w-[45px] sm:max-w-none truncate">{currentLang.nativeName}</span>
                <ChevronDown
                  size={10}
                  className={`opacity-80 transition-transform shrink-0 ${langDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-40 sm:w-44 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-scale-in origin-top-right text-xs">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        updateSettings({ language: lang.code });
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer ${
                        settings.language === lang.code ? 'font-bold text-[#3c229e] bg-indigo-50/50' : 'text-slate-700'
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
          </nav>
        </div>
      </div>
    </header>
  );
}
