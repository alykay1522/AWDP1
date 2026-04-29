const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

function readPkg(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

const rootPkg = readPkg('package.json');
const sitePkg = readPkg('artifacts/awdp-site/package.json');
const libPkg = readPkg('lib/api-client-react/package.json');

if (rootPkg.scripts) delete rootPkg.scripts.preinstall;

const merged = {};
[rootPkg, sitePkg, libPkg].forEach(function(pkg) {
  ['dependencies', 'devDependencies'].forEach(function(s) {
    if (pkg[s]) {
      Object.keys(pkg[s]).forEach(function(k) {
        merged[k] = pkg[s][k];
      });
    }
  });
});

merged['@replit/vite-plugin-runtime-error-modal'] = 'latest';
merged['tailwindcss'] = 'latest';

Object.keys(merged).forEach(function(k) {
  if (merged[k].startsWith('workspace:')) {
    merged[k] = 'file:lib/api-client-react';
  } else if (merged[k].startsWith('catalog:')) {
    merged[k] = '*';
  }
});

rootPkg.dependencies = merged;
delete rootPkg.devDependencies;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));

['dependencies', 'devDependencies', 'peerDependencies'].forEach(function(s) {
  if (libPkg[s]) {
    Object.keys(libPkg[s]).forEach(function(k) {
      if (libPkg[s][k].startsWith('catalog:')) libPkg[s][k] = '*';
    });
  }
});
fs.writeFileSync('lib/api-client-react/package.json', JSON.stringify(libPkg, null, 2));

console.log('All deps merged into root');
execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
console.log('Done');
