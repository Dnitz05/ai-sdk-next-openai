// tailwind.config.js (o .ts / .mjs)

/** @type {import('tailwindcss').Config} */
module.exports = { // O 'import type { Config } ... export default {' si és .ts
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  // ---- CORRECCIÓ AQUÍ ----
  plugins: [
    require('@tailwindcss/typography') // Afegim el plugin necessari
  ],
  // -----------------------
};