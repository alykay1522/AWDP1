/**
 * Vercel install hook — uses npm directly, no pnpm required.
 * Resolves workspace:* and catalog: specifiers before installing.
 */
const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = __dirname;

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}  [${cwd || root}]`);
  execSync(cmd, { stdio: "inherit", shell: true, cwd: cwd || root });
}

// ── 1. Resolve catalog: specifiers from pnpm-workspace.yaml ──────────────────
function parseCatalog() {
  const yaml = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const catalog = {};
  let inCatalog = false;
  for (const line of yaml.split("\n")) {
    if (/^catalog:/.test(line)) { inCatalog = true; continue; }
    if (inCatalog) {
      if (line && !/^\s/.test(line)) break;
      const m = line.match(/^\s+'?([^':]+)'?\s*:\s*(.+)/);
      if (m) catalog[m[1].trim()] = m[2].trim();
    }
  }
  return catalog;
}

// ── 2. Resolve workspace:* specifiers — map package name → local folder ──────
function buildWorkspaceMap() {
  const map = {};
  const search = [
    path.join(root, "artifacts"),
    path.join(root, "lib"),
  ];
  for (const dir of search) {
    if (!fs.existsSync(dir)) continue;
    for (const sub of fs.readdirSync(dir)) {
      const pkgPath = path.join(dir, sub, "package.json");
      if (!fs.existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name) map[pkg.name] = path.join(dir, sub);
      } catch {}
    }
  }
  return map;
}

// ── 3. Write a resolved package.json into a temp dir and npm install it ───────
function installPackage(pkgDir, catalog, wsMap) {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  let changed = false;

  for (const section of ["dependencies", "devDependencies"]) {
    if (!pkg[section]) continue;
    for (const [name, ver] of Object.entries(pkg[section])) {
      if (ver.startsWith("catalog:")) {
        const resolved = catalog[name];
        if (resolved) { pkg[section][name] = resolved; changed = true; }
        else { delete pkg[section][name]; changed = true; }
      } else if (ver.startsWith("workspace:")) {
        // Replace with local file: reference
        const localPath = wsMap[name];
        if (localPath) { pkg[section][name] = `file:${localPath}`; changed = true; }
        else { delete pkg[section][name]; changed = true; }
      }
    }
  }

  // Remove pnpm-specific fields
  delete pkg.packageManager;

  const tmpPkg = path.join(pkgDir, "_vercel_pkg_tmp.json");
  const origPkg = path.join(pkgDir, "package.json");
  const backup  = path.join(pkgDir, "_pkg_backup.json");

  fs.copyFileSync(origPkg, backup);
  fs.writeFileSync(origPkg, JSON.stringify(pkg, null, 2));

  try {
    run(`npm install --legacy-peer-deps --prefer-offline`, pkgDir);
  } finally {
    fs.copyFileSync(backup, origPkg);
    fs.unlinkSync(backup);
    if (fs.existsSync(tmpPkg)) fs.unlinkSync(tmpPkg);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log("[vercel-install] Starting npm-based install...");

const catalog = parseCatalog();
const wsMap   = buildWorkspaceMap();

console.log(`[vercel-install] Catalog packages: ${Object.keys(catalog).length}`);
console.log(`[vercel-install] Workspace packages: ${Object.keys(wsMap).length}`);

// Install each package that needs it
const targets = [
  path.join(root, "lib", "db"),
  path.join(root, "lib", "api-zod"),
  path.join(root, "artifacts", "api-server"),
  path.join(root, "artifacts", "awdp-site"),
];

for (const target of targets) {
  console.log(`\n[vercel-install] Installing ${path.basename(target)}...`);
  installPackage(target, catalog, wsMap);
}

console.log("\n[vercel-install] Done.");
