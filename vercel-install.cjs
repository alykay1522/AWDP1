/**
 * Vercel install hook — uses npm directly, no pnpm required.
 * Resolves workspace:* and catalog: specifiers before installing.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = __dirname;

// Packages known to need a native postinstall step (fetching a prebuilt binary).
// Rebuilding only these by name avoids retriggering broken scripts on unrelated deps.
const NATIVE_REBUILD_TARGETS = ["esbuild", "sharp"];

function run(command, cwd) {
  console.log(`\n$ ${command}  [${cwd || root}]`);
  execSync(command, {
    stdio: "inherit",
    shell: true,
    cwd: cwd || root,
    env: process.env,
  });
}

function parseCatalog() {
  const workspacePath = path.join(root, "pnpm-workspace.yaml");
  const yaml = fs.readFileSync(workspacePath, "utf8");
  const catalog = {};
  let inCatalog = false;

  for (const line of yaml.split("\n")) {
    if (/^catalog:/.test(line)) {
      inCatalog = true;
      continue;
    }

    if (!inCatalog) continue;
    if (line && !/^\s/.test(line)) break;

    const match = line.match(/^\s+'?([^':]+)'?\s*:\s*(.+)/);
    if (match) catalog[match[1].trim()] = match[2].trim();
  }

  return catalog;
}

function buildWorkspaceMap() {
  const map = {};
  const roots = [path.join(root, "artifacts"), path.join(root, "lib")];

  for (const directory of roots) {
    if (!fs.existsSync(directory)) continue;

    for (const child of fs.readdirSync(directory)) {
      const packagePath = path.join(directory, child, "package.json");
      if (!fs.existsSync(packagePath)) continue;

      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        if (packageJson.name) map[packageJson.name] = path.join(directory, child);
      } catch (error) {
        console.warn(`[vercel-install] Skipping invalid package.json: ${packagePath}`);
      }
    }
  }

  return map;
}

function installPackage(packageDirectory, catalog, workspaceMap) {
  const packageJsonPath = path.join(packageDirectory, "package.json");
  if (!fs.existsSync(packageJsonPath)) return;

  const original = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(original);

  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    if (!packageJson[section]) continue;

    for (const [name, version] of Object.entries(packageJson[section])) {
      if (typeof version !== "string") continue;

      if (version.startsWith("catalog:")) {
        const resolved = catalog[name];
        if (resolved) packageJson[section][name] = resolved;
        else delete packageJson[section][name];
      } else if (version.startsWith("workspace:")) {
        const localPath = workspaceMap[name];
        if (localPath) packageJson[section][name] = `file:${localPath}`;
        else delete packageJson[section][name];
      }
    }
  }

  delete packageJson.packageManager;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  try {
    // --ignore-scripts: some registry deps (e.g. connect-pg-simple) ship a broken
    // "prepare": "husky install" that fails outside a git checkout with devDependencies
    // installed, killing the whole install. A bare `npm rebuild` reruns every package's
    // scripts (including that broken one), so only rebuild the specific packages that
    // actually need a native postinstall step.
    run("npm install --legacy-peer-deps --prefer-offline --no-audit --no-fund --ignore-scripts", packageDirectory);
    const declared = new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
      ...Object.keys(packageJson.optionalDependencies || {}),
    ]);
    const rebuildTargets = NATIVE_REBUILD_TARGETS.filter((name) => declared.has(name));
    if (rebuildTargets.length > 0) {
      run(`npm rebuild ${rebuildTargets.join(" ")}`, packageDirectory);
    }
  } finally {
    fs.writeFileSync(packageJsonPath, original);
  }
}

console.log("[vercel-install] Starting npm-based monorepo install...");

const catalog = parseCatalog();
const workspaceMap = buildWorkspaceMap();
const targets = [
  path.join(root, "lib", "db"),
  path.join(root, "lib", "api-zod"),
  path.join(root, "artifacts", "api-server"),
  path.join(root, "artifacts", "awdp-site"),
];

for (const target of targets) {
  console.log(`\n[vercel-install] Installing ${path.relative(root, target)}...`);
  installPackage(target, catalog, workspaceMap);
}

console.log("\n[vercel-install] Done.");
