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
      // Use the inlined copy inside src/ — eliminates cross-workspace pnpm
      // catalog: resolution that breaks Vercel's isolated install
      "@workspace/api-client-react": path.resolve(siteDir, "src", "lib", "api-client", "index.ts"),
      // Subpath alias: @workspace/api-client-react/src/generated/api.schemas
      // resolves to the local inlined copy at src/lib/api-client/generated/api.schemas
      "@workspace/api-client-react/src": path.resolve(siteDir, "src", "lib", "api-client"),
      "@tanstack/react-query": path.resolve(siteDir, "node_modules", "@tanstack", "react-query"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
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
    sourcemap: false,
    // Suppress "Can't resolve original location" warnings from radix-ui/shadcn
    // sourcemap references — these are harmless but cause fatal errors on Vite 7
    rollupOptions: {
      // Multi-page build. Without an explicit `input`, Vite emits index.html
      // only, so admin.html was never built and the /admin -> /admin.html
      // rewrite fell through to the storefront shell — which carries
      // `robots: index, follow`, leaving the admin UI indexable. admin.html
      // loads the same /src/main.tsx entry and only differs by its
      // `noindex, nofollow, noarchive` meta and title.
      input: {
        main: path.resolve(siteDir, "index.html"),
        admin: path.resolve(siteDir, "admin.html"),
      },
      onwarn(warning, warn) {
        // Suppress sourcemap warnings from dependencies
        if (warning.code === "SOURCEMAP_ERROR") return;
        if (warning.message?.includes("Can't resolve original location")) return;
        warn(warning);
      },
      output: {},
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
