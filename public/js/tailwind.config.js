// Loaded right after the Tailwind Play CDN script on every page.
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f2f6fb',
          100: '#e1eaf5',
          200: '#c3d4ea',
          300: '#97b4d9',
          400: '#648dc2',
          500: '#416fa9',
          600: '#30578d',
          700: '#284772',
          800: '#243d5f',
          900: '#1b2d47',
          950: '#111d30',
        },
        gold: {
          50: '#fbf8f0',
          100: '#f5edd6',
          200: '#ead9a9',
          300: '#dfc27a',
          400: '#d6b25e',
          500: '#c39a3c',
          600: '#a67d2e',
          700: '#856127',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
      },
    },
  },
};
