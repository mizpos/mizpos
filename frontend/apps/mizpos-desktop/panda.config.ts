import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      tokens: {
        animations: {
          fadeIn: { value: "fadeIn 0.15s ease-out" },
          slideUp: { value: "slideUp 0.2s ease-out" },
          slideDown: { value: "slideDown 0.2s ease-out" },
          pulse: { value: "pulse 1.5s ease-in-out infinite" },
          shake: { value: "shake 0.4s ease-in-out" },
          scaleIn: { value: "scaleIn 0.15s ease-out" },
        },
        colors: {
          // ダークテーマ用のSlateベースカラー
          slate: {
            50: { value: "#f8fafc" },
            100: { value: "#f1f5f9" },
            200: { value: "#e2e8f0" },
            300: { value: "#cbd5e1" },
            400: { value: "#94a3b8" },
            500: { value: "#64748b" },
            600: { value: "#475569" },
            700: { value: "#334155" },
            800: { value: "#1e293b" },
            900: { value: "#0f172a" },
            950: { value: "#020617" },
          },
          // アクセントカラー
          blue: {
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
          green: {
            50: { value: "#f0fdf4" },
            100: { value: "#dcfce7" },
            200: { value: "#bbf7d0" },
            300: { value: "#86efac" },
            400: { value: "#4ade80" },
            500: { value: "#22c55e" },
            600: { value: "#16a34a" },
            700: { value: "#15803d" },
            800: { value: "#166534" },
            900: { value: "#14532d" },
          },
          red: {
            50: { value: "#fef2f2" },
            100: { value: "#fee2e2" },
            200: { value: "#fecaca" },
            300: { value: "#fca5a5" },
            400: { value: "#f87171" },
            500: { value: "#ef4444" },
            600: { value: "#dc2626" },
            700: { value: "#b91c1c" },
            800: { value: "#991b1b" },
            900: { value: "#7f1d1d" },
          },
          amber: {
            50: { value: "#fffbeb" },
            100: { value: "#fef3c7" },
            200: { value: "#fde68a" },
            300: { value: "#fcd34d" },
            400: { value: "#fbbf24" },
            500: { value: "#f59e0b" },
            600: { value: "#d97706" },
            700: { value: "#b45309" },
            800: { value: "#92400e" },
            900: { value: "#78350f" },
          },
        },
        fonts: {
          body: {
            value:
              "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          mono: {
            value: "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace",
          },
        },
        fontSizes: {
          xs: { value: "11px" },
          sm: { value: "13px" },
          md: { value: "15px" },
          lg: { value: "17px" },
          xl: { value: "20px" },
          "2xl": { value: "24px" },
          "3xl": { value: "28px" },
          "4xl": { value: "36px" },
          "5xl": { value: "48px" },
        },
        fontWeights: {
          normal: { value: "400" },
          medium: { value: "500" },
          semibold: { value: "600" },
          bold: { value: "700" },
        },
        radii: {
          sm: { value: "4px" },
          md: { value: "6px" },
          lg: { value: "8px" },
          xl: { value: "10px" },
          "2xl": { value: "12px" },
          "3xl": { value: "16px" },
          full: { value: "9999px" },
        },
        spacing: {
          px: { value: "1px" },
          0: { value: "0" },
          1: { value: "4px" },
          2: { value: "8px" },
          3: { value: "12px" },
          4: { value: "16px" },
          5: { value: "20px" },
          6: { value: "24px" },
          8: { value: "32px" },
          10: { value: "40px" },
          12: { value: "48px" },
          16: { value: "64px" },
        },
        shadows: {
          sm: { value: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
          md: {
            value:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          },
          lg: {
            value:
              "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
          },
          xl: {
            value:
              "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
          },
          "2xl": { value: "0 25px 50px -12px rgb(0 0 0 / 0.25)" },
          modal: { value: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" },
        },
      },
      semanticTokens: {
        colors: {
          // 背景色
          bg: {
            base: { value: "{colors.slate.900}" },
            surface: { value: "{colors.slate.800}" },
            elevated: { value: "{colors.slate.700}" },
            muted: { value: "{colors.slate.600}" },
          },
          // テキスト色
          text: {
            primary: { value: "{colors.slate.50}" },
            secondary: { value: "{colors.slate.400}" },
            muted: { value: "{colors.slate.500}" },
            inverse: { value: "{colors.slate.900}" },
          },
          // ボーダー色
          border: {
            DEFAULT: { value: "{colors.slate.700}" },
            subtle: { value: "{colors.slate.600}" },
          },
          // アクセント色
          accent: {
            primary: { value: "{colors.blue.500}" },
            success: { value: "{colors.green.500}" },
            danger: { value: "{colors.red.500}" },
            warning: { value: "{colors.amber.500}" },
          },
        },
      },
    },
  },

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
