/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        broadsheet: {
          cream: '#F6F4EE',
          ink: '#14171A',
          terracotta: '#B84A28',
          'terracotta-hover': '#9E3E20',
          paper: '#FFFFFF',
          rule: '#DDD8CE',
          'rule-subtle': '#E8E3D8',
          muted: '#6B665E',
          // Dark mode specific (Aged broadsheet night edition)
          'dark-bg': '#0C0E11',
          'dark-paper': '#13171E',
          'dark-text': '#ECE8DE',
          'dark-brass': '#D4A359',
          'dark-brass-hover': '#B88B43',
          'dark-rule': '#252B35',
          'dark-muted': '#8A867E',
        },
        market: {
          profit: '#18633F',
          'profit-bg': '#E9F5EE',
          loss: '#B92525',
          'loss-bg': '#FDF0F0',
          'profit-dark': '#3DBE7F',
          'loss-dark': '#F26B6B',
        },
      },
      boxShadow: {
        ledger: '0 1px 3px 0 rgba(20, 23, 26, 0.05)',
        'ledger-hover': '0 4px 12px 0 rgba(20, 23, 26, 0.08)',
      },
    },
  },
  plugins: [],
};
