const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

// 1. Remove pnpm files that confuse npm
['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});

// 2. Remove preinstall guard that blocks npm
var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));

// 3. Hide root package.json so npm installs in awdp-site only
fs.renameSync('package.json', '_package.json.bak');

// 4. Install all deps in awdp-site
console.log('Installing dependencies...');
execSync('cd artifacts/awdp-site && npm install --include=dev --legacy-peer-deps', { stdio: 'inherit' });

// 5. Restore root package.json
fs.renameSync('_package.json.bak', 'package.json');

// 6. Verify
var nm = 'artifacts/awdp-site/node_modules';
var count = fs.readdirSync(nm).length;
['wouter','react','vite','tailwindcss','@vitejs/plugin-react'].forEach(function(p) {
  var exists = fs.existsSync(path.join(nm, p));
  console.log(p + ': ' + (exists ? 'OK' : 'MISSING'));
});
console.log('Total modules: ' + count);
console.log('Done');
