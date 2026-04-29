import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const siteDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
});
