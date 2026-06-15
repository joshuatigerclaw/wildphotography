/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Override Tailwind defaults that clash with the dark editorial theme
        white:        'oklch(0.98 0 0)',    // was rgb(255 255 255) — map to paper-white for text/background utilities
        gray: {
          50:  'oklch(0.21 0.01 60)',       // was #f9fafb — dark inset surface
          100: 'oklch(0.21 0.01 60)',       // was #f3f4f6
          200: 'oklch(0.25 0.01 60)',       // was #e5e7eb — raised surface
          300: 'oklch(0.60 0.02 80)',       // was #d1d5db — ink-muted level
          400: 'oklch(0.60 0.02 80)',       // was #9ca3af — ink-muted level
          500: 'oklch(0.65 0.02 80)',       // was #6b7280 — ink-dim level
          600: 'oklch(0.70 0.02 80)',       // was #4b5563 — readable on dark bg
          700: 'oklch(0.75 0.02 80)',       // was #374151 — ink level
          800: 'oklch(0.80 0.02 80)',       // was #1f2937 — ink level
          900: 'oklch(0.85 0.01 80)',       // was #111827 — ink-strong level
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
