/**
 * Vercel build hook — builds api-server then the frontend site.
 * Using a .cjs script (like vercel-install.cjs) avoids shell cd fragility.
 */
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname);

function run(cmd, cwd) {
  console.log(`\n[vercel-build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", shell: true, cwd: cwd || repoRoot });
}

// 1. Build the API server (creates artifacts/api-server/dist/serverless.mjs)
console.log("\n[vercel-build] Step 1: build api-server...");
run("node ./build.mjs", path.join(repoRoot, "artifacts", "api-server"));

// 2. Build the frontend site
console.log("\n[vercel-build] Step 2: build awdp-site...");
run("npx vite build", path.join(repoRoot, "artifacts", "awdp-site"));

console.log("\n[vercel-build] Done.");
