/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Electric Indigo & Cyan — Vivid SaaS & Tech Design System
        paper: {
          DEFAULT: '#F8FAFC', // Ultra-light Slate canvas
          card: '#FFFFFF',
          sunken: '#F1F5F9',
          hover: '#F1F5F9',
        },
        ink: {
          DEFAULT: '#0F172A', // Ultra-crisp Slate-900 primary text
          soft: '#334155',   // Slate-700
          muted: '#64748B',  // Slate-500
          faint: '#94A3B8',  // Slate-400
        },
        line: {
          DEFAULT: '#E2E8F0', // Slate-200
          strong: '#CBD5E1',  // Slate-300
        },
        accent: {
          DEFAULT: '#4F46E5', // Vivid Indigo-600
          hover: '#4338CA',   // Indigo-700
          soft: '#EEF2FF',    // Indigo-50
          cyan: '#06B6D4',    // Electric Cyan-500
          ring: 'rgba(79, 70, 229, 0.25)',
        },
        success: { DEFAULT: '#059669', soft: '#ECFDF5' },
        danger: { DEFAULT: '#E11D48', soft: '#FFF1F2' },
        warning: { DEFAULT: '#D97706', soft: '#FFFBEB' },
        info: { DEFAULT: '#0284C7', soft: '#F0F9FF' },
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
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 10px 30px -12px rgba(15, 23, 42, 0.08)',
        'card-hover': '0 4px 12px -2px rgba(79, 70, 229, 0.12), 0 20px 40px -15px rgba(79, 70, 229, 0.18)',
        focus: '0 0 0 3px rgba(79, 70, 229, 0.25)',
        pop: '0 24px 60px -20px rgba(15, 23, 42, 0.25)',
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
        'scan-y': {
          '0%, 100%': { top: '8%' },
          '50%': { top: '88%' },
        },
        shimmer: {
          '0%': { left: '-40%' },
          '100%': { left: '100%' },
        },
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
