import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const siteDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(siteDir, "src"),
      "@assets": path.resolve(siteDir, "..", "..", "attached_assets"),
      "@workspace/api-client-react": path.resolve(siteDir, "..", "..", "lib", "api-client-react", "src", "index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: siteDir,
  build: {
    outDir: path.resolve(siteDir, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
