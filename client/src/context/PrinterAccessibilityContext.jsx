import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SUPPORTED_LANGUAGES, getTranslation } from '../lib/printerI18n.js';

const ACCESSIBILITY_STORAGE_KEY = 'printer_station_ux4g_accessibility_v3';

const DEFAULT_SETTINGS = {
  fontScale: 100, // 70% to 250% (step by 10%)
  density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
  highContrast: false,
  largeNumerals: false,
  language: 'en', // 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml'
  securityCoverMode: 'BOTH', // 'BOTH' | 'FRONT_ONLY' | 'NONE'
};

const PrinterAccessibilityContext = createContext(null);

export function PrinterAccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        let scale = Number(parsed.fontScale);
        if (isNaN(scale) || scale < 50 || scale > 300) {
          scale = 100;
        }
        let lang = parsed.language || 'en';
        if (lang === 'English') lang = 'en';
        if (lang === 'Hindi') lang = 'hi';
        if (lang === 'Tamil') lang = 'ta';
        if (lang === 'Telugu') lang = 'te';
        return { ...DEFAULT_SETTINGS, ...parsed, fontScale: scale, language: lang };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);



  const updateSettings = (newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Translation helper function
  const t = useCallback(
    (key, params = {}) => {
      return getTranslation(settings.language || 'en', key, params);
    },
    [settings.language]
  );

  // Increase font size (steps of 10%, max 250%)
  const increaseFontSize = () => {
    setSettings((prev) => {
      const nextScale = Math.min(250, (prev.fontScale || 100) + 10);
      const updated = { ...prev, fontScale: nextScale };
      try {
        localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Decrease font size (steps of 10%, min 70%)
  const decreaseFontSize = () => {
    setSettings((prev) => {
      const nextScale = Math.max(70, (prev.fontScale || 100) - 10);
      const updated = { ...prev, fontScale: nextScale };
      try {
        localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Reset font size to standard 100%
  const resetFontSize = () => {
    updateSettings({ fontScale: 100 });
  };

  const resetAllSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {}
  };

  const scaleRatio = (settings.fontScale || 100) / 100;

  const spacingGapClass =
    settings.density === 'spacious'
      ? 'gap-5 sm:gap-6'
      : settings.density === 'compact'
      ? 'gap-2.5 sm:gap-3'
      : 'gap-3.5 sm:gap-4.5';

  const cardPaddingClass =
    settings.density === 'spacious'
      ? 'p-5 sm:p-6'
      : settings.density === 'compact'
      ? 'p-3 sm:p-3.5'
      : 'p-4 sm:p-5';

  const contrastClass = settings.highContrast
    ? 'border-slate-400 shadow-md ring-1 ring-slate-900/15 [&_.card]:border-slate-400 [&_.card]:bg-white'
    : '';

  const numeralWeightClass = settings.largeNumerals
    ? 'font-black tracking-tight scale-105 origin-left'
    : 'font-bold';

  return (
    <PrinterAccessibilityContext.Provider
      value={{
        settings,
        updateSettings,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        resetAllSettings,
        scaleRatio,
        spacingGapClass,
        cardPaddingClass,
        contrastClass,
        numeralWeightClass,
        optionsModalOpen,
        setOptionsModalOpen,
        t,
        SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </PrinterAccessibilityContext.Provider>
  );
}

export function usePrinterAccessibility() {
  const ctx = useContext(PrinterAccessibilityContext);
  if (!ctx) {
    throw new Error('usePrinterAccessibility must be used within PrinterAccessibilityProvider');
  }
  return ctx;
}
