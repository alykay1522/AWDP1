/**
 * Vercel build hook — builds the API server and storefront from the monorepo root.
 */
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

if (process.env.VERCEL_GIT_COMMIT_REF === "audit/product-duplicates-and-image-quality") {
  console.log("\n[vercel-build] Preview catalog audit...");
  run("node ./scripts/preview-catalog-audit.mjs", path.join(repoRoot, "artifacts", "api-server"));
}

console.log("\n[vercel-build] Step 1: build API server...");
run("node ./build.mjs", path.join(repoRoot, "artifacts", "api-server"));

console.log("\n[vercel-build] Step 2: build storefront...");
run("npx vite build", path.join(repoRoot, "artifacts", "awdp-site"));

console.log("\n[vercel-build] Done.");
