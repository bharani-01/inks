/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light-first "ink on paper" system. No purple gradient fills.
        paper: {
          DEFAULT: '#F1EFFB', // page background
          card: '#FFFFFF',
          sunken: '#FAF9FF',
          hover: '#ECE9F9',
        },
        ink: {
          DEFAULT: '#171528', // primary text + dark buttons
          soft: '#4A4763',
          muted: '#7A7791',
          faint: '#A9A5BE',
        },
        line: {
          DEFAULT: '#E4E1F0',
          strong: '#D3CFE6',
        },
        accent: {
          DEFAULT: '#4338CA', // restrained indigo, solid
          hover: '#3A30B0',
          soft: '#EEF0FF',
          ring: 'rgba(67, 56, 202, 0.35)',
        },
        success: { DEFAULT: '#047857', soft: '#ECFDF5' },
        danger: { DEFAULT: '#DC2626', soft: '#FEF2F2' },
        warning: { DEFAULT: '#B45309', soft: '#FFFBEB' },
        info: { DEFAULT: '#0369A1', soft: '#F0F9FF' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 21, 40, 0.04), 0 8px 24px -12px rgba(23, 21, 40, 0.10)',
        'card-hover': '0 2px 4px rgba(23, 21, 40, 0.05), 0 16px 40px -16px rgba(23, 21, 40, 0.16)',
        focus: '0 0 0 3px rgba(67, 56, 202, 0.30)',
        pop: '0 24px 60px -20px rgba(23, 21, 40, 0.28)',
      },
      maxWidth: {
        content: '1560px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
        // Scanner head sweeping down and back up a page (upload animation).
        'scan-y': {
          '0%, 100%': { top: '8%' },
          '50%': { top: '88%' },
        },
        // Light band running along the progress track.
        shimmer: {
          '0%': { left: '-40%' },
          '100%': { left: '100%' },
        },
        // Gentle bob for the drop-zone icon while dragging.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scan-y': 'scan-y 1.7s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        float: 'float 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
