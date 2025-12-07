import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Get git commit hash
const getGitCommitHash = (): string => {
  try {
    return (
      process.env.VITE_COMMIT_HASH ||
      execSync("git rev-parse --short HEAD").toString().trim()
    );
  } catch {
    return "unknown";
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || "0.0.0"),
    __COMMIT_HASH__: JSON.stringify(getGitCommitHash()),
    __BUILD_TIMESTAMP__: JSON.stringify(
      process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString(),
    ),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "styled-system": fileURLToPath(
        new URL("./styled-system", import.meta.url),
      ),
    },
  },
});
