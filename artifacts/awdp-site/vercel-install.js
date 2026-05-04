const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'].forEach(function(f) {
  try { fs.unlinkSync(f); } catch(e) {}
});

var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));

fs.renameSync('package.json', '_package.json.bak');

console.log('Installing dependencies...');
execSync('cd artifacts/awdp-site && npm install --include=dev --legacy-peer-deps', { stdio: 'inherit' });

var siteNm = path.resolve('artifacts/awdp-site/node_modules');
var libNm = path.resolve('lib/api-client-react/node_modules');
try { fs.rmSync(libNm, { recursive: true, force: true }); } catch(e) {}
fs.symlinkSync(siteNm, libNm, 'dir');
console.log('Symlinked node_modules into lib/api-client-react');

fs.renameSync('_package.json.bak', 'package.json');

var count = fs.readdirSync(siteNm).length;
['wouter','react','vite','@tanstack/react-query','@vitejs/plugin-react'].forEach(function(p) {
  console.log(p + ': ' + (fs.existsSync(path.join(siteNm, p)) ? 'OK' : 'MISSING'));
});
console.log('Total modules: ' + count);
console.log('Done');
