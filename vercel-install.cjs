const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: isWindows,
    ...options,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  return result.status ?? 1;
}

if (run("corepack", ["enable"]) !== 0) {
  console.warn("corepack enable failed; continuing with the package manager available in the environment.");
}

let status = run("pnpm", ["install", "--frozen-lockfile"]);

if (status !== 0) {
  console.warn("Frozen install failed; retrying with lockfile updates disabled for Vercel install.");
  status = run("pnpm", ["install", "--no-frozen-lockfile"]);
}

process.exit(status);
