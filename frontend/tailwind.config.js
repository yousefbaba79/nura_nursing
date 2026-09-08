/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f8f7",
          100: "#dcece9",
          200: "#b8d9d3",
          300: "#8ec0b7",
          400: "#5fa197",
          500: "#3f847a",
          600: "#316a62",
          700: "#295550",
          800: "#234542",
          900: "#1f3a38",
        },
      },
    },
  },
  plugins: [],
};
