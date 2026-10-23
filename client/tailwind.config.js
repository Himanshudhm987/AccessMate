/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#06090F',
          900: '#090D16',
          850: '#0D121F',
          800: '#121828'
        },
        navy: {
          900: '#111827',
          800: '#161F33',
          700: '#1C263D',
          600: '#263452',
          500: '#34476E'
        },
        electric: {
          DEFAULT: '#00D2FF',
          hover: '#00B8E6',
          muted: 'rgba(0, 210, 255, 0.15)',
          glow: 'rgba(0, 210, 255, 0.4)'
        },
        flame: {
          DEFAULT: '#FF6B00',
          hover: '#E55F00',
          muted: 'rgba(255, 107, 0, 0.15)',
          glow: 'rgba(255, 107, 0, 0.4)'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'electric-glow': '0 0 25px -5px rgba(0, 210, 255, 0.35)',
        'flame-glow': '0 0 25px -5px rgba(255, 107, 0, 0.35)',
        'card-elevated': '0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(35, 48, 77, 0.5)'
      }
    }
  },
  plugins: []
};
