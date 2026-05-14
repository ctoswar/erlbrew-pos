/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        erl: {
          base: 'rgb(var(--color-base) / <alpha-value>)',
          surface: 'rgb(var(--color-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
          sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
          input: 'rgb(var(--color-input) / <alpha-value>)',
          'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
          'border-default': 'rgb(var(--color-border-default) / <alpha-value>)',
          'border-medium': 'rgb(var(--color-border-medium) / <alpha-value>)',
          'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
          accent: 'rgb(var(--color-accent) / <alpha-value>)',
          'accent-light': 'rgb(var(--color-accent-light) / <alpha-value>)',
          'accent-dim': 'rgb(var(--color-accent-dim) / <alpha-value>)',
          'accent-muted': 'rgb(var(--color-accent-muted) / <alpha-value>)',
          'accent-faint': 'rgb(var(--color-accent-faint) / <alpha-value>)',
          'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
          'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
          'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
          'text-faint': 'rgb(var(--color-text-faint) / <alpha-value>)',
          'text-disabled': 'rgb(var(--color-text-disabled) / <alpha-value>)',
          success: 'rgb(var(--color-success) / <alpha-value>)',
          'success-bg': 'rgb(var(--color-success-bg) / <alpha-value>)',
          'success-border': 'rgb(var(--color-success-border) / <alpha-value>)',
          danger: 'rgb(var(--color-danger) / <alpha-value>)',
          'danger-bg': 'rgb(var(--color-danger-bg) / <alpha-value>)',
          'danger-border': 'rgb(var(--color-danger-border) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Crimson Pro"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)',
        md: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
        lg: '0 8px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)',
        xl: '0 16px 48px rgba(0,0,0,0.7), 0 8px 16px rgba(0,0,0,0.5)',
        'glow-accent': '0 0 24px rgba(196,149,106,0.15), 0 0 48px rgba(196,149,106,0.08)',
        'glow-success': '0 0 20px rgba(122,191,122,0.12)',
        inner: 'inset 0 1px 2px rgba(255,255,255,0.03)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        luxury: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        successPop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeInOverlay: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        scanLine: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '50%': { transform: 'translateY(130px)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.3', boxShadow: '0 0 24px rgba(196,149,106,0.08)' },
          '50%': { opacity: '1', boxShadow: '0 0 36px rgba(196,149,106,0.25)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        ripple: {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'success-pop': 'successPop 0.55s spring forwards',
        'slide-in-right': 'slideInRight 0.35s ease-out forwards',
        'scale-in': 'scaleIn 0.35s ease-out forwards',
        'pulse-slow': 'pulse 2.5s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in-overlay': 'fadeInOverlay 0.25s ease forwards',
        'slide-up': 'slideUp 0.35s spring forwards',
        'scan-line': 'scanLine 2.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'ripple': 'ripple 1s ease-out forwards',
      },
    },
  },
  plugins: [],
}
