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

console.log("\n[vercel-build] Step 2: build storefront...");
run("npx vite build", path.join(repoRoot, "artifacts", "awdp-site"));

if (process.env.VERCEL_GIT_COMMIT_REF === "research/sibling-pdf-recovery") {
  console.log("\n[vercel-build] Step 3: run targeted PDF recovery probe...");
  run("node ./scripts/pdf-domain-probe-fast.mjs", repoRoot);
}

console.log("\n[vercel-build] Done.");
