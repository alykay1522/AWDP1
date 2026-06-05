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
      // Force the api-client-react lib (which uses pnpm catalog: specifier) to use
      // the same @tanstack/react-query installed in the site's node_modules.
      // Without this alias Rollup cannot resolve "catalog:" at build time and fails.
      "@tanstack/react-query": path.resolve(siteDir, "node_modules", "@tanstack", "react-query"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: siteDir,

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "wouter",
    ],
    force: true,
  },

  esbuild: {
    legalComments: "none",
    sourcemap: false,
  },

  build: {
    outDir: path.resolve(siteDir, "dist/public"),
    emptyOutDir: true,
    target: "es2022",
    minify: "esbuild",
    sourcemap: false, // set to true only for debugging
    chunkSizeWarningLimit: 1200,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // React and its direct ecosystem get their own clean chunk
            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("@tanstack/react-query") ||
              id.includes("wouter")
            ) {
              return "react-vendor";
            }
            // Everything else
            return "vendor";
          }
        },
      },
    },
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
