const { cpSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const source = join(root, "OneDrive", "Documentos", "allwindowdoorparts-build");
const destination = join(root, "artifacts", "awdp-site", "dist", "public");

if (!existsSync(source)) {
  console.error(`Static site source not found: ${source}`);
  process.exit(1);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });

console.log(`Copied static site to ${destination}`);
