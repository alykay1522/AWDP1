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

console.log("\n[vercel-build] Step 1: build API server...");
run("node ./build.mjs", path.join(repoRoot, "artifacts", "api-server"));

console.log("\n[vercel-build] Step 2: import scraped PDF resources...");
run("node ./scripts/import-recovered-pdf-resources.mjs", repoRoot);

console.log("\n[vercel-build] Step 3: build storefront...");
run("npx vite build", path.join(repoRoot, "artifacts", "awdp-site"));

console.log("\n[vercel-build] Done.");
