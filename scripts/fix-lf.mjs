import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "vercel.json",
  "api/ping.mjs",
  "api/[...path].mjs",
  "api/admin/[...path].mjs",
  "api/catalog/[...path].mjs",
  "api/checkout/[...path].mjs",
  "api/paypal/[...path].mjs",
  "api/products/[...path].mjs",
  "api/storage/[...path].mjs",
];

for (const file of files) {
  const bytes = readFileSync(file);
  if (!bytes.includes(0x0d)) continue;
  writeFileSync(
    file,
    Buffer.from(
      bytes.toString("latin1").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
      "latin1",
    ),
  );
  console.log(`normalized ${file}`);
}
