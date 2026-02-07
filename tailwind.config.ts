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
          bg: "#0d1117",
          surface: "#161b22",
          border: "#30363d",
          muted: "#8b949e",
          accent: "#58a6ff",
          green: "#3fb950",
          red: "#f85149",
          amber: "#d29922",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "monospace"],
        sans: ["system-ui", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
