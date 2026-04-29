const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

process.chdir(path.resolve(__dirname));

function patch(file, extraDeps) {
  if (!fs.existsSync(file)) return;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (pkg.scripts) delete pkg.scripts.preinstall;
  for (const s of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (!pkg[s]) continue;
    for (const k of Object.keys(pkg[s])) {
      const v = pkg[s][k];
      if (v.startsWith('workspace:')) {
        const rel = path.relative(path.dirname(file), 'lib/api-client-react');
        pkg[s][k] = 'file:' + rel;
      } else if (v.startsWith('catalog:')) {
        pkg[s][k] = '*';
      }
    }
  }
  if (extraDeps) {
    pkg.dependencies = pkg.dependencies || {};
    Object.assign(pkg.dependencies, extraDeps);
  }
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
  console.log('Patched', file);
}

patch('package.json');
patch('artifacts/awdp-site/package.json', {
  '@replit/vite-plugin-runtime-error-modal': 'latest',
  'tailwindcss': 'latest'
});
patch('lib/api-client-react/package.json');

console.log('Installing root deps...');
execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });

console.log('Installing awdp-site deps...');
execSync('cd artifacts/awdp-site && npm install --legacy-peer-deps', { stdio: 'inherit' });
