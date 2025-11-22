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
          },
          success: { value: "#10b981" },
          warning: { value: "#f59e0b" },
          error: { value: "#ef4444" },
        },
        fonts: {
          body: { value: "system-ui, sans-serif" },
          heading: { value: "system-ui, sans-serif" },
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
    },
  },

  outdir: "styled-system",
  jsxFramework: "react",
});
