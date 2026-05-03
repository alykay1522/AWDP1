const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});

var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;

var allDeps = {};
[rootPkg, sitePkg, libPkg].forEach(function(pkg) {
  ['dependencies', 'devDependencies'].forEach(function(section) {
    if (!pkg[section]) return;
    Object.keys(pkg[section]).forEach(function(k) {
      var v = pkg[section][k];
      if (v.startsWith('workspace:')) return;
      if (v.startsWith('file:')) return;
      if (v.startsWith('catalog:')) v = '*';
      allDeps[k] = v;
    });
  });
});

allDeps['tailwindcss'] = '^4.0.0';
allDeps['tw-animate-css'] = 'latest';
allDeps['@tailwindcss/typography'] = 'latest';
allDeps['@tanstack/react-query'] = '^5.28.0';
delete allDeps['@replit/vite-plugin-runtime-error-modal'];
delete allDeps['@replit/vite-plugin-cartographer'];
delete allDeps['@replit/vite-plugin-dev-banner'];

rootPkg.dependencies = allDeps;
delete rootPkg.devDependencies;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));

fs.renameSync('package.json', '_package.json.bak');

console.log('Installing dependencies...');
execSync('cd artifacts/awdp-site && npm install --include=dev --legacy-peer-deps', { stdio: 'inherit' });

var siteNm = path.resolve('artifacts/awdp-site/node_modules');
var libNm = path.resolve('lib/api-client-react/node_modules');
try { fs.rmSync(libNm, { recursive: true, force: true }); } catch(e) {}
fs.symlinkSync(siteNm, libNm, 'dir');
console.log('Symlinked node_modules into lib/api-client-react');

fs.renameSync('_package.json.bak', 'package.json');
console.log('Step 2: merged ' + Object.keys(allDeps).length + ' deps into root');

var vite = [
  'import { defineConfig } from "vite";',
  'import react from "@vitejs/plugin-react";',
  'import tailwindcss from "@tailwindcss/vite";',
  'import path from "path";',
  'import { fileURLToPath } from "url";',
  '',
  'const siteDir = path.dirname(fileURLToPath(import.meta.url));',
  '',
  'export default defineConfig({',
  '  plugins: [react(), tailwindcss()],',
  '  resolve: {',
  '    alias: {',
  '      "@": path.resolve(siteDir, "src"),',
  '      "@assets": path.resolve(siteDir, "..", "..", "attached_assets"),',
  '      "@workspace/api-client-react": path.resolve(siteDir, "..", "..", "lib", "api-client-react", "src", "index.ts"),',
  '    },',
  '    dedupe: ["react", "react-dom"],',
  '  },',
  '  root: siteDir,',
  '  build: {',
  '    outDir: path.resolve(siteDir, "dist/public"),',
  '    emptyOutDir: true,',
  '  },',
  '});',
  ''
].join('\n');
fs.writeFileSync('artifacts/awdp-site/vite.config.mts', vite);
try { fs.rmSync('artifacts/awdp-site/vite.config.ts', { force: true }); } catch (e) {}
console.log('Step 3: rewrote vite.config.mts');

console.log('Step 4: installing...');
try {
  execSync('npm install --legacy-peer-deps --include=dev', { stdio: 'inherit' });
} catch (err) {
  console.error('Install failed in Step 4.');
  throw err;
}

var count = fs.readdirSync(siteNm).length;
['wouter','react','vite','@tanstack/react-query','@vitejs/plugin-react'].forEach(function(p) {
  console.log(p + ': ' + (fs.existsSync(path.join(siteNm, p)) ? 'OK' : 'MISSING'));
});
console.log('Total modules: ' + count);
console.log('Done');
