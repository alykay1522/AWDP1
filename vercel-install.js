const path = require('path');
const { execSync } = require('child_process');

process.chdir(path.resolve(__dirname));

console.log('Compatibility install: using npm workspaces');
execSync('npm install --workspaces --include=dev --legacy-peer-deps', {
  stdio: 'inherit',
});
console.log('Install complete');
