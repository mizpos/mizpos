import { execSync } from "node:child_process";
import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Get git commit hash
const getGitCommitHash = (): string => {
  try {
    return (
      // @ts-expect-error process is a nodejs global
      process.env.VITE_COMMIT_HASH ||
      execSync("git rev-parse --short HEAD").toString().trim()
    );
  } catch {
    return "unknown";
  }
};

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
  define: {
    // @ts-expect-error process is a nodejs global
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || "0.1.0"),
    __COMMIT_HASH__: JSON.stringify(getGitCommitHash()),
    __BUILD_TIMESTAMP__: JSON.stringify(
      // @ts-expect-error process is a nodejs global
      process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString(),
    ),
  },
  resolve: {
    alias: {
      "styled-system": path.resolve(__dirname, "./styled-system"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
