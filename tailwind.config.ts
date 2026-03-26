import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors (from DESIGN.md)
        charcoal: {
          DEFAULT: "#32373c",
          dark: "#1d2124",
          light: "#464c52",
        },
        "off-white": "#f8f9fa",
        // Border colors
        border: {
          light: "#e9ecef",
          medium: "#abb8c3",
        },
        // Text colors
        muted: "#6c757d",
        // Semantic / functional colors
        success: "#00d084",
        error: "#cf2e2e",
        warning: "#fcb900",
        info: "#0693e3",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "800px",
        layout: "1200px",
      },
      boxShadow: {
        card: "6px 6px 9px rgba(0, 0, 0, 0.2)",
        elevated: "12px 12px 50px rgba(0, 0, 0, 0.4)",
        sharp: "6px 6px 0px rgba(0, 0, 0, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
