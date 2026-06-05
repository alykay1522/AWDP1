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

  // esbuild + Vite optimizations
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "wouter",
      "framer-motion",
      "recharts",
      "lucide-react",
      "date-fns",
      "cmdk",
      "sonner",
      // Core Radix (most used in shadcn/ui)
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-popover",
      "@radix-ui/react-toast",
    ],
  },

  esbuild: {
    legalComments: "none",
    sourcemap: true, // Fixes "Can't resolve original location of error" for shadcn/ui components
  },

  build: {
    outDir: path.resolve(siteDir, "dist/public"),
    emptyOutDir: true,
    target: "es2022",
    minify: "esbuild",
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("@tanstack/react-query") || id.includes("wouter")) {
              return "react-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }
            if (id.includes("framer-motion")) {
              return "motion";
            }
            if (id.includes("recharts")) {
              return "charts";
            }
            if (id.includes("date-fns") || id.includes("lucide-react") || id.includes("cmdk") || id.includes("sonner")) {
              return "utils";
            }
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
