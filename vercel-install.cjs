/**
 * Vercel install hook: this repo is a pnpm workspace (workspace:*, catalog:).
 * npm cannot resolve those protocols — install from the monorepo root with pnpm.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname);
process.chdir(repoRoot);

function run(cmd) {
  execSync(cmd, { stdio: "inherit", shell: true, cwd: repoRoot, env: process.env });
}

console.log("Installing monorepo dependencies with pnpm (required for workspace:/catalog: protocols)...");

try {
  run("corepack enable");
} catch (e) {
  console.warn("corepack enable:", e && e.message ? e.message : e);
}

const useFrozen = process.env.VERCEL_INSTALL_NO_FROZEN !== "1";
try {
  if (useFrozen) {
    run("pnpm install --frozen-lockfile");
  } else {
    run("pnpm install");
  }
} catch (e) {
  if (useFrozen) {
    console.warn("pnpm install --frozen-lockfile failed; retrying without frozen lockfile");
    run("pnpm install --no-frozen-lockfile");
  } else {
    throw e;
  }
}

const siteDir = path.join(repoRoot, "artifacts", "awdp-site");
const siteNm = path.join(siteDir, "node_modules");
const libNm = path.join(repoRoot, "lib", "api-client-react", "node_modules");

if (fs.existsSync(siteNm)) {
  // Symlink only if target dir exists and is not already a symlink
  try {
    if (fs.existsSync(libNm)) {
      const stat = fs.lstatSync(libNm);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(libNm);
      } else {
        fs.rmSync(libNm, { recursive: true, force: true });
      }
    }
    fs.mkdirSync(path.dirname(libNm), { recursive: true });
    fs.symlinkSync(siteNm, libNm, "dir");
    console.log("Symlinked artifacts/awdp-site/node_modules -> lib/api-client-react/node_modules");
  } catch (err) {
    console.warn("Symlink skipped (invalid path or permission):", err && err.message ? err.message : err);
  }
}

if (fs.existsSync(siteNm)) {
  const count = fs.readdirSync(siteNm).length;
  ["wouter", "react", "vite", "@tanstack/react-query", "@vitejs/plugin-react"].forEach(function (p) {
    console.log(p + ": " + (fs.existsSync(path.join(siteNm, p)) ? "OK" : "MISSING"));
  });
  console.log("Total top-level entries in awdp-site/node_modules: " + count);
}

console.log("vercel-install: done");
