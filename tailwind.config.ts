import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Verde botánico ligeramente más profundo y menos "neón"
        verde: {
          50:  "#eef5e8",
          100: "#d8e9ca",
          200: "#b3d49c",
          300: "#84b96a",
          400: "#5a9b43",
          500: "#3f7d2b",
          600: "#2f6221",
          700: "#264e1b",
          800: "#1f3e17",
          900: "#173010",
          950: "#0b1c08",
        },
        // Crema un poco más cálido
        crema: {
          50:  "#fdfbf6",
          100: "#f8f3e8",
          200: "#f0e9d6",
          300: "#e6dcc0",
          400: "#d6c8a2",
          500: "#b9a77c",
        },
        // Tierra con más presencia
        tierra: {
          400: "#ab8e59",
          500: "#8f703f",
          600: "#705728",
          700: "#57451f",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
      boxShadow: {
        card:       "0 1px 2px 0 rgba(23,48,16,0.06), 0 1px 3px 0 rgba(23,48,16,0.05)",
        "card-lg":  "0 2px 4px -1px rgba(23,48,16,0.05), 0 8px 20px -6px rgba(23,48,16,0.10)",
        "card-hover": "0 4px 8px -2px rgba(23,48,16,0.06), 0 14px 28px -8px rgba(23,48,16,0.14)",
      },
    },
  },
  plugins: [],
};
export default config;
