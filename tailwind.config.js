/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        el: {
          bg: '#0a0f1a',
          panel: '#0f172a',
          card: '#111827',
          border: '#1e293b',
          accent: '#3b82f6',
        },
        navy: '#0f172a',
        'navy-deep': '#07101e',
        paper: '#e2e8f0',
        accent: '#3b82f6',
        'accent-fg': '#eff6ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
