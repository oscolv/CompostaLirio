import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: {
          50: "#f0f7ec",
          100: "#dcefd3",
          200: "#b9dfaa",
          300: "#8cca72",
          400: "#5fb044",
          500: "#3d8a27",
          600: "#2f6d1d",
          700: "#275619",
          800: "#224517",
          900: "#1a3612",
          950: "#0d1f08",
        },
        crema: {
          50: "#fefdfb",
          100: "#faf8f3",
          200: "#f3efe5",
          300: "#e9e3d4",
          400: "#ddd5c0",
          500: "#c4b898",
        },
        tierra: {
          400: "#a89260",
          500: "#8c7544",
          600: "#6b5c2a",
          700: "#574a22",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "card-lg": "0 4px 12px -2px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)",
        "card-hover": "0 8px 24px -4px rgba(0,0,0,0.1), 0 4px 8px -4px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
