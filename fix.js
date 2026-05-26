const fs = require('fs');
const text = fs.readFileSync('pnpm-lock.yaml', 'utf8');
const lines = text.split('\n');
const key = '@floating-ui/core@1.7.5';
let found = false;
let skip = 0;
const out = [];
for (const line of lines) {
  if (skip > 0) { skip--; continue; }
  if (line.includes(key) && !found) { found = true; skip = 1; console.log('Removed duplicate at: ' + line.trim()); continue; }
  out.push(line);
}
fs.writeFileSync('pnpm-lock.yaml', out.join('\n'));
console.log('Done. Found duplicate: ' + found);
