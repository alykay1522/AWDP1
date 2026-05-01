const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});

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

console.log('Merged ' + Object.keys(allDeps).length + ' deps into root');
execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });

var link = path.resolve('artifacts/awdp-site/node_modules');
try { fs.rmSync(link, { recursive: true, force: true }); } catch(e) {}
fs.symlinkSync(path.resolve('node_modules'), link, 'dir');
console.log('Done');

