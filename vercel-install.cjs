/**
 * Vercel install hook: pnpm workspace (workspace:*, catalog: protocols).
 * Custom because npm/yarn can't resolve them. Optimized for Vercel build cache:
 * - corepack prepare for fast activation
 * - frozen-lockfile preferred (Vercel caches pnpm store + node_modules on lockfile hit)
 * - prefer-offline via .npmrc for metadata cache hits
 * - hoisted + shamefully-hoist for monorepo compatibility
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname);
process.chdir(repoRoot);

function run(cmd) {
  execSync(cmd, { stdio: "inherit", shell: true, cwd: repoRoot, env: process.env });
}

console.log("[vercel-install] pnpm monorepo install (cache-optimized)...");

try {
  run("corepack enable");
  run("corepack prepare pnpm@9.15.9 --activate");
} catch (e) {
  console.warn("corepack prepare:", e && e.message ? e.message : e);
}

// Always use --no-frozen-lockfile on Vercel to avoid lockfile drift errors.
// Vercel may run a different Node/pnpm version than local, causing spurious
// ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE failures.
try {
  run("pnpm install --no-frozen-lockfile");
} catch (e) {
  console.warn("pnpm install failed, retrying once...");
  run("pnpm install --no-frozen-lockfile --ignore-scripts");
}

// Symlink for lib/api-client-react (Vite alias resolution without duplicate installs)
const siteDir = path.join(repoRoot, "artifacts", "awdp-site");
const siteNm = path.join(siteDir, "node_modules");
const libNm = path.join(repoRoot, "lib", "api-client-react", "node_modules");

if (fs.existsSync(siteNm)) {
  try {
    if (fs.existsSync(libNm)) {
      const stat = fs.lstatSync(libNm);
      if (stat.isSymbolicLink()) {
        // Already correct? Skip heavy ops
        const target = fs.readlinkSync(libNm);
        if (target === siteNm || path.resolve(path.dirname(libNm), target) === siteNm) {
          console.log("Symlink already correct, skipping recreation");
        } else {
          fs.unlinkSync(libNm);
          fs.symlinkSync(siteNm, libNm, "dir");
        }
      } else {
        fs.rmSync(libNm, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(libNm), { recursive: true });
        fs.symlinkSync(siteNm, libNm, "dir");
      }
    } else {
      fs.mkdirSync(path.dirname(libNm), { recursive: true });
      fs.symlinkSync(siteNm, libNm, "dir");
    }
    console.log("[vercel-install] Symlinked awdp-site/node_modules -> lib/api-client-react/node_modules");
  } catch (err) {
    console.warn("Symlink skipped:", err && err.message ? err.message : err);
  }
}

// Quick validation (helps debug cache misses)
if (fs.existsSync(siteNm)) {
  const count = fs.readdirSync(siteNm).length;
  const checks = ["wouter", "react", "vite", "@tanstack/react-query", "@vitejs/plugin-react"];
  checks.forEach(function (p) {
    console.log(p + ": " + (fs.existsSync(path.join(siteNm, p)) ? "OK" : "MISSING"));
  });
  console.log("awdp-site/node_modules entries: " + count);
}

console.log("[vercel-install] done - cache should be warm for next deploy if lockfile unchanged");
