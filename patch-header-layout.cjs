const fs = require("fs");
const path = require("path");

const siteRoot = path.join(__dirname, "artifacts", "awdp-site");
const layoutPath = path.join(siteRoot, "src", "components", "layout.tsx");
const assetsPath = path.join(siteRoot, "src", "lib", "assetUrls.ts");

let layout = fs.readFileSync(layoutPath, "utf8");
const oldClass = "w-full h-auto max-h-24 sm:max-h-32 md:max-h-44 object-contain mx-auto block";
if (!layout.includes(oldClass)) {
  throw new Error("Expected header image class was not found");
}
layout = layout.replace(oldClass, "block w-full h-auto");
fs.writeFileSync(layoutPath, layout);

let assets = fs.readFileSync(assetsPath, "utf8");
assets = assets.replace(
  /export const headerBg\s*=\s*[^;]+;/,
  'export const headerBg   = "/assets/header_bg.webp?v=uploaded-20260629-1";',
);
fs.writeFileSync(assetsPath, assets);

console.log("[header] Applied full-width, uncropped header layout");
