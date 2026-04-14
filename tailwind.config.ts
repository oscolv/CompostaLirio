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
        // ── Ink verde, óxido botánico (antes "verde")
        tinta: {
          50:  "#f1f3ee",
          100: "#dee3d5",
          200: "#bcc6ae",
          300: "#8fa17f",
          400: "#667c58",
          500: "#4a6340",
          600: "#35492e",
          700: "#253621",
          800: "#18261a",
          900: "#0f1a11",
          950: "#080f09",
        },
        // ── Papel crema, fondo
        papel: {
          50:  "#fbf8f1",
          100: "#f5efe3",
          200: "#ece2cf",
          300: "#ddd0b3",
          400: "#c9b890",
          500: "#b19d71",
        },
        // ── Arcilla, acento cálido de urgencia
        arcilla: {
          50:  "#faefe9",
          100: "#f3d8cb",
          200: "#e6b39c",
          300: "#d58567",
          400: "#c45f3c",
          500: "#b94e2b",
          600: "#9a3c20",
          700: "#7a301b",
          800: "#5c2418",
          900: "#3b1710",
        },
        // ── Ocre, dato y warning cálido
        ocre: {
          50:  "#faf3e2",
          100: "#f3e2b8",
          200: "#e8c97d",
          300: "#d9ac48",
          400: "#c78a2e",
          500: "#a87020",
          600: "#865818",
          700: "#644112",
        },
        // ── Azul-sabio, series de datos y links sutiles
        dato: {
          50:  "#eef2f4",
          100: "#d6dfe4",
          200: "#a9bbc5",
          300: "#7a94a3",
          400: "#567285",
          500: "#3f5a6d",
          600: "#2d4354",
          700: "#1f3140",
        },
        // ── Alias para mantener verde existente en lib/estado.ts y similares
        verde: {
          50:  "#f1f3ee",
          100: "#dee3d5",
          200: "#bcc6ae",
          300: "#8fa17f",
          400: "#667c58",
          500: "#4a6340",
          600: "#35492e",
          700: "#253621",
          800: "#18261a",
          900: "#0f1a11",
          950: "#080f09",
        },
        crema: {
          50:  "#fbf8f1",
          100: "#f5efe3",
          200: "#ece2cf",
          300: "#ddd0b3",
          400: "#c9b890",
          500: "#b19d71",
        },
        tierra: {
          400: "#c45f3c",
          500: "#b94e2b",
          600: "#9a3c20",
          700: "#7a301b",
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        kicker: "0.22em",
      },
      borderRadius: {
        xs: "2px",
        "2xl": "14px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(15,26,17,0.04), 0 1px 2px 0 rgba(15,26,17,0.05)",
        "card-lg": "0 1px 0 0 rgba(15,26,17,0.04), 0 6px 18px -8px rgba(15,26,17,0.10)",
        "card-hover": "0 2px 0 0 rgba(15,26,17,0.05), 0 14px 32px -10px rgba(15,26,17,0.16)",
        ink: "0 1px 0 0 #0f1a11",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-fade": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "reveal-y": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "pulse-fade": "pulse-fade 1.5s ease-in-out infinite",
        "reveal-y": "reveal-y 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
