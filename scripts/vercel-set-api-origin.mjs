#!/usr/bin/env node
/**
 * Sets Vercel env vars so admin proxy + client can reach Express.
 * Requires: `npx vercel link` in this repo once, and `vercel login`.
 *
 * Usage:
 *   node scripts/vercel-set-api-origin.mjs https://api.yourdomain.com
 *
 * Uses `vercel env add ... --value ... --yes --force` (non-interactive, overwrites same target).
 *
 * Sets:
 *   API_SERVER_ORIGIN — serverless admin proxy
 *   VITE_API_BASE_URL — Vite build + functions fallback
 * for: production, preview
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const origin = process.argv[2]?.trim().replace(/\/+$/, "");
if (!origin || !/^https?:\/\//i.test(origin)) {
  console.error("Usage: node scripts/vercel-set-api-origin.mjs https://your-express-host.com");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function runVercelEnvAdd(name, env) {
  const args = [
    "vercel",
    "env",
    "add",
    name,
    env,
    "--value",
    origin,
    "--yes",
    "--force",
    "--no-sensitive",
  ];
  const r = spawnSync("npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  return r.status ?? 1;
}

const names = ["API_SERVER_ORIGIN", "VITE_API_BASE_URL"];
const envs = ["production", "preview"];

console.log(`Setting ${names.join(", ")} for ${envs.join(", ")} to:\n  ${origin}\n`);

for (const env of envs) {
  for (const name of names) {
    console.log(`--- ${name} (${env}) ---`);
    const code = runVercelEnvAdd(name, env);
    if (code !== 0) {
      console.warn(`(exit ${code} — check vercel login / link, or set ${name} in the dashboard)`);
    }
  }
}

console.log("\nRedeploy on Vercel so new env values apply to builds and functions.");
