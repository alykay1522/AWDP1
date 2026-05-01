const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

// 1. Remove pnpm files
['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});
console.log('1. Cleaned pnpm files');

// 2. Read all package.json files
var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
var sitePkg = JSON.parse(fs.readFileSync('artifacts/awdp-site/package.json', 'utf8'));
var libPkg = JSON.parse(fs.readFileSync('lib/api-client-react/package.json', 'utf8'));

// 3. Remove pnpm guard and workspaces
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
delete rootPkg.workspaces;

// 4. Merge ALL deps into root
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

// 5. Fix versions and remove Replit packages
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
console.log('2. Merged ' + Object.keys(allDeps).length + ' deps into root');

// 6. Install at ROOT
execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });

// 7. Verify key packages
var ok = 0;
var missing = [];
['wouter', 'react', 'vite', 'tailwindcss', '@vitejs/plugin-react', '@tailwindcss/vite'].forEach(function(pkg) {
  if (fs.existsSync(path.join('node_modules', pkg))) { ok++; }
  else { missing.push(pkg); }
});
console.log('3. Verified: ' + ok + ' found' + (missing.length ? ', MISSING: ' + missing.join(', ') : ''));

// 8. Symlink so Vite finds everything from awdp-site
var link = path.resolve('artifacts/awdp-site/node_modules');
try { fs.rmSync(link, { recursive: true, force: true }); } catch(e) {}
fs.symlinkSync(path.resolve('node_modules'), link, 'dir');
console.log('4. Symlinked node_modules into awdp-site');

console.log('ALL DONE');
