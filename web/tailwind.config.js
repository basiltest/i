/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Neutral tokens are CSS vars (RGB channels) so they flip in dark mode.
        page: 'rgb(var(--c-page) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          hover: 'rgb(var(--c-accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
        },
        grad: { from: '#E0114A', via: '#8A1C9A', to: '#2233C4' },
        up: 'rgb(var(--c-accent) / <alpha-value>)',
        down: '#F4212E',
        success: '#00BA7C',
        warn: '#FFD400',
      },
      borderRadius: { xl2: '1rem' },
      boxShadow: {
        card: '0 1px 3px rgba(15,20,25,0.04)',
        pop: '0 8px 28px rgba(15,20,25,0.12)',
        glow: '0 4px 14px -3px rgba(138,28,154,0.38), 0 2px 8px -4px rgba(34,51,196,0.34)',
        glowStrong: '0 12px 28px -6px rgba(224,17,74,0.38), 0 8px 20px -6px rgba(34,51,196,0.46)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'pop-in': {
          '0%': { opacity: 0, transform: 'translateY(6px) scale(.98)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'pop-in': 'pop-in .16s ease-out',
      },
    },
  },
  plugins: [],
}
