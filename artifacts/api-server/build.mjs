import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, copyFile, mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await mkdir(path.resolve(distDir, "assets"), { recursive: true });
  await copyFile(
    path.resolve(artifactDir, "src/assets/awdp-logo.png"),
    path.resolve(distDir, "assets/awdp-logo.png")
  );

  await esbuild({
    entryPoints: [
      path.resolve(artifactDir, "src/index.ts"),
      path.resolve(artifactDir, "src/serverless.ts"),
    ],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Only externalize packages that TRULY cannot be bundled:
    // - native .node binaries (loaded dynamically, can't be inlined)
    // - sharp (uses native libvips, loads sibling .node files by path)
    // - @google-cloud/* (loads sibling .proto files via path traversal)
    // Everything else — express, drizzle-orm, pg, zod, nodemailer, etc. — is bundled
    // directly into serverless.mjs so Vercel doesn't need them in node_modules at runtime.
    external: [
      "*.node",
      "sharp",
      "pg-native",
      "bcrypt",
      "argon2",
      "canvas",
      "fsevents",
      "re2",
      "cpu-features",
      "ssh2",
      "dtrace-provider",
      "isolated-vm",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
