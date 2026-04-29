const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});
console.log('Step 1: cleaned pnpm files');

var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
var sitePkg = JSON.parse(fs.readFileSync('artifacts/awdp-site/package.json', 'utf8'));
var libPkg = JSON.parse(fs.readFileSync('lib/api-client-react/package.json', 'utf8'));

if (rootPkg.scripts) delete rootPkg.scripts.preinstall;

var allDeps = {};
[rootPkg, sitePkg, libPkg].forEach(function(pkg) {
  ['dependencies', 'devDependencies'].forEach(function(section) {
    if (!pkg[section]) return;
    Object.keys(pkg[section]).forEach(function(k) {
      var v = pkg[section][k];
      if (v.startsWith('workspace:')) return;
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
console.log('Step 2: merged ' + Object.keys(allDeps).length + ' deps into root');

var vite = [
  'import { defineConfig } from "vite";',
  'import react from "@vitejs/plugin-react";',
  'import tailwindcss from "@tailwindcss/vite";',
  'import path from "path";',
  '',
  'export default defineConfig({',
  '  plugins: [react(), tailwindcss()],',
  '  resolve: {',
  '    alias: {',
  '      "@": path.resolve(import.meta.dirname, "src"),',
  '      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),',
  '      "@workspace/api-client-react": path.resolve(import.meta.dirname, "..", "..", "lib", "api-client-react", "src", "index.ts"),',
  '    },',
  '    dedupe: ["react", "react-dom"],',
  '  },',
  '  root: path.resolve(import.meta.dirname),',
  '  build: {',
  '    outDir: path.resolve(import.meta.dirname, "dist/public"),',
  '    emptyOutDir: true,',
  '  },',
  '});',
  ''
].join('\n');
fs.writeFileSync('artifacts/awdp-site/vite.config.ts', vite);
console.log('Step 3: rewrote vite.config.ts');

console.log('Step 4: installing...');
execSync('npm install --legacy-peer-deps --include=dev', { stdio: 'inherit' });

var target = path.resolve('node_modules');
var link = path.resolve('artifacts/awdp-site/node_modules');
try { fs.rmSync(link, { recursive: true, force: true }); } catch(e) {}
fs.symlinkSync(target, link, 'dir');
console.log('Step 5: linked node_modules');

console.log('ALL DONE');
