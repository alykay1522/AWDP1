const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname);
process.chdir(repoRoot);

["pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"].forEach(function (f) {
  try {
    fs.unlinkSync(f);
  } catch (e) {}
});

var backupPath = path.join(repoRoot, "_package.json.bak");
fs.copyFileSync("package.json", backupPath);

var rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
fs.writeFileSync("package.json", JSON.stringify(rootPkg, null, 2));

function restoreRootPackageJson() {
  try {
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, "package.json");
    }
  } catch (e) {
    console.error("Failed to restore root package.json from _package.json.bak:", e);
  }
}

var siteDir = path.join(repoRoot, "artifacts", "awdp-site");

try {
  console.log("Installing dependencies in", siteDir, "...");
  execSync("npm install --include=dev --legacy-peer-deps", {
    stdio: "inherit",
    shell: true,
    cwd: siteDir,
    env: process.env,
  });

  var siteNm = path.join(siteDir, "node_modules");
  var libNm = path.join(repoRoot, "lib", "api-client-react", "node_modules");
  try {
    fs.rmSync(libNm, { recursive: true, force: true });
  } catch (e) {}
  fs.mkdirSync(path.dirname(libNm), { recursive: true });
  fs.symlinkSync(siteNm, libNm, "dir");
  console.log("Symlinked node_modules into lib/api-client-react");

  var count = fs.readdirSync(siteNm).length;
  ["wouter", "react", "vite", "@tanstack/react-query", "@vitejs/plugin-react"].forEach(function (p) {
    console.log(p + ": " + (fs.existsSync(path.join(siteNm, p)) ? "OK" : "MISSING"));
  });
  console.log("Total modules: " + count);
  console.log("Done");
} finally {
  restoreRootPackageJson();
}
