/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b0c',
        coal: '#141518',
        slate2: '#1d1f24',
        line: '#2a2d33',
        red: { DEFAULT: '#e11d2e', dark: '#a3121f', soft: '#3a1015' },
        mute: '#9aa0a8',
      },
      fontFamily: {
        display: ['"Oswald"', 'Impact', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
