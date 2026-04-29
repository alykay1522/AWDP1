const fs = require('fs');
const { execSync } = require('child_process');

// Patch awdp-site: replace pnpm workspace: with npm file:
const sitePkg = JSON.parse(fs.readFileSync('artifacts/awdp-site/package.json', 'utf8'));
sitePkg.dependencies['@workspace/api-client-react'] = 'file:../../lib/api-client-react';
sitePkg.dependencies['@replit/vite-plugin-runtime-error-modal'] = 'latest';
fs.writeFileSync('artifacts/awdp-site/package.json', JSON.stringify(sitePkg, null, 2));

// Patch api-client-react: replace pnpm catalog: with actual version
const libPkg = JSON.parse(fs.readFileSync('lib/api-client-react/package.json', 'utf8'));
if (libPkg.dependencies && libPkg.dependencies['@tanstack/react-query']) {
  libPkg.dependencies['@tanstack/react-query'] = '^5.28.0';
}
fs.writeFileSync('lib/api-client-react/package.json', JSON.stringify(libPkg, null, 2));

// Install with npm (bypasses broken pnpm on Vercel)
execSync('cd artifacts/awdp-site && npm install --legacy-peer-deps', { stdio: 'inherit' });
