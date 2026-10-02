/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg: '#050811',
          card: '#0a1020',
          panel: 'rgba(12, 22, 44, 0.75)',
          border: 'rgba(0, 210, 255, 0.25)',
          borderHover: 'rgba(0, 229, 255, 0.6)',
          cyan: '#00e5ff',
          blue: '#0070f3',
          glow: 'rgba(0, 229, 255, 0.35)',
          textDim: '#7e93b2'
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 229, 255, 0.25)',
        'glow-cyan-lg': '0 0 25px rgba(0, 229, 255, 0.4)',
        'glow-cyan-sm': '0 0 8px rgba(0, 229, 255, 0.3)'
      }
    },
  },
  plugins: [],
}
