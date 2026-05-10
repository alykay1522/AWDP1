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
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--");
const origin = args.find((a) => /^https?:\/\//i.test(a))?.trim().replace(/\/+$/, "");
if (!origin) {
  console.error("Usage: node scripts/vercel-set-api-origin.mjs https://your-express-host.com");
  console.error('  (pnpm may insert "--"; that is OK)');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(join(root, ".vercel", "project.json"))) {
  console.error(
    [
      "This folder is not linked to a Vercel project (.vercel/project.json missing).",
      "",
      "From the repo root, run once:",
      "  npx vercel login",
      "  npx vercel link",
      "",
      "Pick your AWDP team/account and the existing project when prompted.",
      "Then run this script again.",
      "",
      "Or set variables in Vercel Dashboard → Project → Settings → Environment Variables:",
      "  API_SERVER_ORIGIN = " + origin,
      "  VITE_API_BASE_URL = " + origin,
      "",
      "Apply to Production and Preview, then Redeploy.",
    ].join("\n"),
  );
  process.exit(1);
}

const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

function runVercelEnvAdd(name, env) {
  const cliArgs = [
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
  const r = spawnSync(npxBin, cliArgs, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env,
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
