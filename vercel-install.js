const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

// Step 1: Remove pnpm-only preinstall guard from root
var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));
console.log('Step 1 done: removed preinstall guard');

// Step 2: Patch awdp-site/package.json
var sitePath = 'artifacts/awdp-site/package.json';
var sitePkg = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
sitePkg.dependencies['@workspace/api-client-react'] = 'file:../../lib/api-client-react';
sitePkg.dependencies['@replit/vite-plugin-runtime-error-modal'] = 'latest';
sitePkg.devDependencies['tailwindcss'] = '^4.0.0';
sitePkg.devDependencies['tw-animate-css'] = 'latest';
sitePkg.devDependencies['@tailwindcss/typography'] = 'latest';
fs.writeFileSync(sitePath, JSON.stringify(sitePkg, null, 2));
console.log('Step 2 done: patched awdp-site');

// Step 3: Patch lib/api-client-react/package.json
var libPath = 'lib/api-client-react/package.json';
var libPkg = JSON.parse(fs.readFileSync(libPath, 'utf8'));
['dependencies', 'devDependencies', 'peerDependencies'].forEach(function(s) {
  if (!libPkg[s]) return;
  Object.keys(libPkg[s]).forEach(function(k) {
    if (libPkg[s][k].startsWith('catalog:')) {
      libPkg[s][k] = '*';
    }
  });
});
fs.writeFileSync(libPath, JSON.stringify(libPkg, null, 2));
console.log('Step 3 done: patched api-client-react');

// Step 4: Install in awdp-site
console.log('Step 4: installing dependencies...');
execSync('cd artifacts/awdp-site && npm install --legacy-peer-deps', { stdio: 'inherit' });
console.log('All done!');
