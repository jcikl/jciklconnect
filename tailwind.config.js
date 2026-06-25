/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jci: {
          blue: '#0097D7',
          lightblue: '#6EC4E8',
          navy: '#1C3F94',
          teal: '#00B5B5',
        }
      }
    },
  },
  plugins: [],
}

