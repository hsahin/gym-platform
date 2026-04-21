import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@claimtech/ui/dist/**/*.{js,mjs}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
      },
      boxShadow: {
        glow: "0 24px 80px rgba(15, 23, 42, 0.16)",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
export default config;
