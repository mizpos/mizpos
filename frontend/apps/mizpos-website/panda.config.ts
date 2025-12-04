import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  globalCss: {
    html: {
      scrollBehavior: "smooth",
    },
    body: {
      fontFamily: "body",
      lineHeight: "1.6",
      color: "text",
      bg: "bg",
    },
  },

  theme: {
    extend: {
      tokens: {
        colors: {
          // Primary: 鮮やかなブルー系
          primary: {
            50: { value: "#eef2ff" },
            100: { value: "#e0e7ff" },
            200: { value: "#c7d2fe" },
            300: { value: "#a5b4fc" },
            400: { value: "#818cf8" },
            500: { value: "#6366f1" },
            600: { value: "#4f46e5" },
            700: { value: "#4338ca" },
            800: { value: "#3730a3" },
            900: { value: "#312e81" },
          },
          // Secondary: クールなシアン
          secondary: {
            50: { value: "#ecfeff" },
            100: { value: "#cffafe" },
            200: { value: "#a5f3fc" },
            300: { value: "#67e8f9" },
            400: { value: "#22d3ee" },
            500: { value: "#06b6d4" },
            600: { value: "#0891b2" },
            700: { value: "#0e7490" },
            800: { value: "#155e75" },
            900: { value: "#164e63" },
          },
          // Accent: 温かみのあるオレンジ
          accent: {
            50: { value: "#fff7ed" },
            100: { value: "#ffedd5" },
            200: { value: "#fed7aa" },
            300: { value: "#fdba74" },
            400: { value: "#fb923c" },
            500: { value: "#f97316" },
            600: { value: "#ea580c" },
            700: { value: "#c2410c" },
            800: { value: "#9a3412" },
            900: { value: "#7c2d12" },
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
          mono: { value: "'JetBrains Mono', 'Fira Code', monospace" },
        },
        fontSizes: {
          "display-2xl": { value: "4.5rem" },
          "display-xl": { value: "3.75rem" },
          "display-lg": { value: "3rem" },
          "display-md": { value: "2.25rem" },
          "display-sm": { value: "1.875rem" },
          "display-xs": { value: "1.5rem" },
        },
        spacing: {
          section: { value: "6rem" },
          "section-sm": { value: "4rem" },
        },
        radii: {
          card: { value: "1rem" },
          button: { value: "0.5rem" },
        },
        shadows: {
          card: {
            value:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          },
          "card-hover": {
            value:
              "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
          },
          glow: { value: "0 0 40px -10px rgb(99 102 241 / 0.5)" },
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: "{colors.gray.50}" },
            muted: { value: "{colors.gray.100}" },
            subtle: { value: "{colors.gray.200}" },
            dark: { value: "{colors.gray.900}" },
            darker: { value: "{colors.gray.950}" },
          },
          text: {
            DEFAULT: { value: "{colors.gray.900}" },
            muted: { value: "{colors.gray.600}" },
            subtle: { value: "{colors.gray.400}" },
            inverted: { value: "{colors.gray.50}" },
          },
          border: {
            DEFAULT: { value: "{colors.gray.200}" },
            muted: { value: "{colors.gray.100}" },
          },
        },
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
    },
  },

  patterns: {
    extend: {
      container: {
        transform(props) {
          return {
            maxWidth: "1280px",
            marginX: "auto",
            paddingX: { base: "1rem", md: "2rem" },
            ...props,
          };
        },
      },
    },
  },

  outdir: "styled-system",
  jsxFramework: "react",
});
