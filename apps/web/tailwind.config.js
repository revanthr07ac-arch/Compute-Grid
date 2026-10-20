/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        grid: {
          dark: '#0a0d14',
          card: '#111726',
          cardHover: '#161e31',
          border: '#1f293d',
          accent: '#3b82f6',
          accentViolet: '#8b5cf6',
          accentEmerald: '#10b981',
          accentAmber: '#f59e0b',
          accentRose: '#f43f5e',
          textMuted: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
};
