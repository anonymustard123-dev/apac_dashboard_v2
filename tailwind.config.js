/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bny: {
          navy: '#00243D',
          astronaut: '#00485E',
          primary: '#2D9BAD',
          teal: '#6ABDC6',
          accent: '#B07E25',
          ink: '#111111',
          paper: '#F6F3EE',
          surface: '#00334F',
          dac: '#2D9BAD',
          stablecoin: '#FFBF00',
          funds: '#A78BFA',
        },
      },
      boxShadow: {
        bny: '0 28px 80px rgba(0, 0, 0, 0.38)',
        glow: '0 0 36px rgba(43, 156, 174, 0.38)',
      },
      fontFamily: {
        dashboard: ['var(--font-geist-sans)', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

module.exports = config;
