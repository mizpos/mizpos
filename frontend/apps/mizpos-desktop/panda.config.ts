import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(-5px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      tokens: {
        colors: {
          // POS用のインディゴベースカラー
          primary: {
            50: { value: "#e8eaf6" },
            100: { value: "#c5cae9" },
            200: { value: "#9fa8da" },
            300: { value: "#7986cb" },
            400: { value: "#5c6bc0" },
            500: { value: "#3f51b5" },
            600: { value: "#3949ab" },
            700: { value: "#303f9f" },
            800: { value: "#283593" },
            900: { value: "#1a237e" },
          },
          gray: {
            50: { value: "#fafafa" },
            100: { value: "#f5f5f5" },
            200: { value: "#eeeeee" },
            300: { value: "#e0e0e0" },
            400: { value: "#bdbdbd" },
            500: { value: "#9e9e9e" },
            600: { value: "#757575" },
            700: { value: "#616161" },
            800: { value: "#424242" },
            900: { value: "#212121" },
          },
          success: {
            50: { value: "#e8f5e9" },
            100: { value: "#c8e6c9" },
            500: { value: "#4caf50" },
            600: { value: "#43a047" },
            700: { value: "#388e3c" },
            800: { value: "#2e7d32" },
          },
          error: {
            50: { value: "#ffebee" },
            100: { value: "#ffcdd2" },
            500: { value: "#f44336" },
            600: { value: "#e53935" },
            700: { value: "#d32f2f" },
            800: { value: "#c62828" },
          },
          warning: {
            50: { value: "#fff3e0" },
            500: { value: "#ff9800" },
            700: { value: "#e65100" },
          },
        },
        fonts: {
          body: { value: "system-ui, -apple-system, sans-serif" },
          mono: { value: "monospace" },
        },
        radii: {
          modal: { value: "20px" },
          button: { value: "12px" },
          input: { value: "8px" },
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

  // グローバルCSSの定義（基本スタイルはsrc/styles.cssで定義）
  globalCss: {
    "*": {
      boxSizing: "border-box",
    },
    "button, input, select, textarea": {
      fontFamily: "inherit",
    },
  },

  outdir: "styled-system",
  jsxFramework: "react",
});
