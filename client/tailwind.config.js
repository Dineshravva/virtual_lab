/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        'lab-bg': '#0b0f1a',
        'lab-panel': '#111827',
        'lab-accent': '#38bdf8'
      }
    }
  },
  plugins: []
};
