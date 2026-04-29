const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.chdir(path.resolve(__dirname));

// Step 1: Remove pnpm preinstall guard
var rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (rootPkg.scripts) delete rootPkg.scripts.preinstall;
fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));
console.log('Step 1: removed preinstall guard');

// Step 2: Patch awdp-site/package.json
var sitePath = 'artifacts/awdp-site/package.json';
var sitePkg = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
sitePkg.dependencies['@workspace/api-client-react'] = 'file:../../lib/api-client-react';
delete sitePkg.dependencies['@replit/vite-plugin-runtime-error-modal'];
sitePkg.devDependencies['tailwindcss'] = '^4.0.0';
sitePkg.devDependencies['tw-animate-css'] = 'latest';
sitePkg.devDependencies['@tailwindcss/typography'] = 'latest';
fs.writeFileSync(sitePath, JSON.stringify(sitePkg, null, 2));
console.log('Step 2: patched awdp-site deps');

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
console.log('Step 3: patched api-client-react');

// Step 4: Rewrite vite.config.ts without Replit plugins
var vite = [
  'import { defineConfig } from "vite";',
  'import react from "@vitejs/plugin-react";',
  'import tailwindcss from "@tailwindcss/vite";',
  'import path from "path";',
  '',
  'const rawPort = process.env.PORT ?? "20520";',
  'const port = Number(rawPort);',
  'const basePath = process.env.BASE_PATH ?? "/";',
  '',
  'export default defineConfig({',
  '  base: basePath,',
  '  plugins: [',
  '    react(),',
  '    tailwindcss(),',
  '  ],',
  '  resolve: {',
  '    alias: {',
  '      "@": path.resolve(import.meta.dirname, "src"),',
  '      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),',
  '    },',
  '    dedupe: ["react", "react-dom"],',
  '  },',
  '  root: path.resolve(import.meta.dirname),',
  '  build: {',
  '    outDir: path.resolve(import.meta.dirname, "dist/public"),',
  '    emptyOutDir: true,',
  '  },',
  '  server: {',
  '    port,',
  '    host: "0.0.0.0",',
  '    allowedHosts: true,',
  '    fs: {',
  '      strict: true,',
  '      deny: ["**/.*"],',
  '    },',
  '  },',
  '  preview: {',
  '    port,',
  '    host: "0.0.0.0",',
  '    allowedHosts: true,',
  '  },',
  '});',
  ''
].join('\n');
fs.writeFileSync('artifacts/awdp-site/vite.config.ts', vite);
console.log('Step 4: rewrote vite.config.ts without Replit plugins');

// Step 5: Install
console.log('Step 5: installing...');
execSync('cd artifacts/awdp-site && npm install --legacy-peer-deps', { stdio: 'inherit' });
console.log('All done!');
