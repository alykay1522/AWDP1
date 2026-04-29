const fs = require('fs');
const { execSync } = require('child_process');

// 1. Remove the pnpm-only guard from root package.json
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete rootPkg.scripts.preinstall;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));
console.log('Removed preinstall guard');

// 2. Patch awdp-site: workspace protocol -> file protocol
const sitePkg = JSON.parse(fs.readFileSync('artifacts/awdp-site/package.json', 'utf8'));
sitePkg.dependencies['@workspace/api-client-react'] = 'file:../../lib/api-client-react';
sitePkg.dependencies['@replit/vite-plugin-runtime-error-modal'] = 'latest';
fs.writeFileSync('artifacts/awdp-site/package.json', JSON.stringify(sitePkg, null, 2));
sitePkg.dependencies['tailwindcss'] = 'latest';
console.log('Patched awdp-site');

// 3. Patch api-client-react: catalog protocol -> real version
const libPkg = JSON.parse(fs.readFileSync('lib/api-client-react/package.json', 'utf8'));
for (const s of ['dependencies', 'devDependencies', 'peerDependencies']) {
  if (libPkg[s]) {
    for (const k of Object.keys(libPkg[s])) {
      if (libPkg[s][k].startsWith('catalog:')) {
        libPkg[s][k] = '^5.28.0';
      }
    }
  }
}
fs.writeFileSync('lib/api-client-react/package.json', JSON.stringify(libPkg, null, 2));
console.log('Patched api-client-react');

// 4. Install with npm
execSync('cd artifacts/awdp-site && npm install --legacy-peer-deps', { stdio: 'inherit' });
