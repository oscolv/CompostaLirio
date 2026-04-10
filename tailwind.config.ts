import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: {
          50: "#e8f5e1",
          100: "#f4f1e8",
          800: "#2d5016",
          900: "#1e3a0e",
        },
        crema: {
          50: "#fffef9",
          100: "#f9f7f2",
          200: "#f0ead6",
          300: "#e8e4d4",
          400: "#ddd8c4",
          500: "#c4b98a",
        },
        tierra: {
          600: "#6b5c2a",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
