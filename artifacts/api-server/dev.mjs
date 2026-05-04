/**
 * Cross-platform dev entry: sets NODE_ENV without shell-specific `export`.
 */
import { spawnSync } from "node:child_process";

process.env.NODE_ENV = "development";

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["run", "build"]);
run("pnpm", ["run", "start"]);
