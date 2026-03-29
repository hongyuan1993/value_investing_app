import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bloom: {
          bg: "#07080d",
          surface: "#0f1118",
          "surface-elevated": "#161922",
          border: "rgba(255,255,255,0.08)",
          muted: "#94a3b8",
          accent: "#818cf8",
          "accent-dim": "#6366f1",
          green: "#34d399",
          red: "#f87171",
          amber: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(129, 140, 248, 0.35)",
        card: "0 4px 24px -4px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "mesh-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(56, 189, 248, 0.08), transparent)",
      },
    },
  },
  plugins: [],
};

export default config;
