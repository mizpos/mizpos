import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  theme: {
    extend: {
      tokens: {
        colors: {
          primary: {
            50: { value: "#eff6ff" },
            100: { value: "#dbeafe" },
            200: { value: "#bfdbfe" },
            300: { value: "#93c5fd" },
            400: { value: "#60a5fa" },
            500: { value: "#3b82f6" },
            600: { value: "#2563eb" },
            700: { value: "#1d4ed8" },
            800: { value: "#1e40af" },
            900: { value: "#1e3a8a" },
          },
          gray: {
            50: { value: "#f9fafb" },
            100: { value: "#f3f4f6" },
            200: { value: "#e5e7eb" },
            300: { value: "#d1d5db" },
            400: { value: "#9ca3af" },
            500: { value: "#6b7280" },
            600: { value: "#4b5563" },
            700: { value: "#374151" },
            800: { value: "#1f2937" },
            900: { value: "#111827" },
            950: { value: "#030712" },
          },
          success: { value: "#10b981" },
          warning: { value: "#f59e0b" },
          error: { value: "#ef4444" },
        },
        fonts: {
          body: { value: "'Inter', 'Noto Sans JP', system-ui, sans-serif" },
          heading: { value: "'Inter', 'Noto Sans JP', system-ui, sans-serif" },
        },
        shadows: {
          sidebar: { value: "4px 0 6px -1px rgba(0, 0, 0, 0.1)" },
          card: {
            value:
              "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
          },
          "card-hover": {
            value:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
          },
          overlay: { value: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" },
        },
        sizes: {
          sidebar: { value: "256px" },
          "sidebar-collapsed": { value: "72px" },
          header: { value: "64px" },
        },
        zIndex: {
          sidebar: { value: "40" },
          overlay: { value: "30" },
          header: { value: "20" },
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: "{colors.gray.50}" },
            muted: { value: "{colors.gray.100}" },
            subtle: { value: "{colors.gray.200}" },
          },
          text: {
            DEFAULT: { value: "{colors.gray.900}" },
            muted: { value: "{colors.gray.600}" },
            subtle: { value: "{colors.gray.400}" },
          },
        },
      },
      keyframes: {
        slideInLeft: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        slideOutLeft: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeOut: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
      },
    },
  },

  outdir: "styled-system",
  jsxFramework: "react",
});
