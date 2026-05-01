const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});

var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
delete rootPkg.workspaces;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));

var sitePath = 'artifacts/awdp-site/package.json';
var sitePkg = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
sitePkg.dependencies['@workspace/api-client-react'] = 'file:../../lib/api-client-react';
sitePkg.devDependencies['tailwindcss'] = '^4.0.0';
sitePkg.devDependencies['tw-animate-css'] = 'latest';
sitePkg.devDependencies['@tailwindcss/typography'] = 'latest';
delete sitePkg.devDependencies['@replit/vite-plugin-runtime-error-modal'];
fs.writeFileSync(sitePath, JSON.stringify(sitePkg, null, 2));

var libPath = 'lib/api-client-react/package.json';
var libPkg = JSON.parse(fs.readFileSync(libPath, 'utf8'));
['dependencies', 'devDependencies', 'peerDependencies'].forEach(function(s) {
  if (!libPkg[s]) return;
  Object.keys(libPkg[s]).forEach(function(k) {
    if (libPkg[s][k].startsWith('catalog:')) libPkg[s][k] = '*';
  });
});
fs.writeFileSync(libPath, JSON.stringify(libPkg, null, 2));

console.log('All patched. Installing...');
execSync('cd artifacts/awdp-site && npm install --include=dev --legacy-peer-deps', { stdio: 'inherit' });
console.log('Done');
