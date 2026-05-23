"use strict";
/**
 * Vercel runs install with cwd = this package (artifacts/awdp-site).
 * The real monorepo install logic lives at the repository root; resolve it
 * explicitly so we never rely on fragile relative paths from vercel.json.
 */
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const rootInstaller = path.join(repoRoot, "vercel-install.cjs");

const result = spawnSync(process.execPath, [rootInstaller], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
