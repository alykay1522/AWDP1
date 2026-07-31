/**
 * Vercel build hook — builds the API server and storefront from the monorepo root.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = __dirname;

function run(command, cwd) {
  console.log(`\n[vercel-build] ${command}`);
  execSync(command, {
    stdio: "inherit",
    shell: true,
    cwd: cwd || repoRoot,
    env: process.env,
  });
}

console.log("\n[vercel-build] Step 1: build API server...");
run("node ./build.mjs", path.join(repoRoot, "artifacts", "api-server"));

console.log("\n[vercel-build] Step 2: build storefront...");
run("npx vite build", path.join(repoRoot, "artifacts", "awdp-site"));

/**
 * Step 3: move the SPA shell off "/".
 *
 * Vercel resolves the filesystem BEFORE applying `rewrites`. While an
 * index.html sits at the root of outputDirectory it satisfies "/" directly,
 * so the { "source": "/", "destination": "/api/ssr?path=/" } rewrite never
 * fires and the homepage serves the unrendered shell instead of SSR output.
 *
 * Renaming the shell to app.html leaves "/" with no filesystem match, so the
 * rewrite reaches the SSR function. The SPA fallback rewrite (/:path*) points
 * at /app.html, and api/ssr-v2.mjs reads app.html as its template.
 */
console.log("\n[vercel-build] Step 3: rename SPA shell to app.html...");
const publicDir = path.join(repoRoot, "artifacts", "awdp-site", "dist", "public");
const shellSource = path.join(publicDir, "index.html");
const shellTarget = path.join(publicDir, "app.html");

if (!fs.existsSync(shellSource)) {
  throw new Error(
    `[vercel-build] Expected Vite to emit ${shellSource}, but it is missing. ` +
      "Refusing to continue — / would 404 without the SPA shell.",
  );
}

fs.renameSync(shellSource, shellTarget);
console.log(`[vercel-build] ${shellSource} -> ${shellTarget}`);

console.log("\n[vercel-build] Done.");
