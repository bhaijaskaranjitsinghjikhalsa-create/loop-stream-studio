/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./server/views/**/*.ejs', './server/public/**/*.js'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0420',
        surface: '#1c0b3a',
        surface2: '#2a1257',
        border: '#3b1d6e',
        primary: '#d946ef',
        primary2: '#a855f7',
        accent: '#ec4899',
        ink: '#fae8ff',
        muted: '#c4a8e8',
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
