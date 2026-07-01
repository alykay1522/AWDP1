import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contactRoutePath = path.resolve(__dirname, "../api/contact.js");
const contactRouteUrl = pathToFileURL(contactRoutePath).href;

test("/api/contact Vercel entrypoint delegates to the shared Express API", async () => {
  const source = await readFile(contactRoutePath, "utf8");
  const route = await import(contactRouteUrl);

  assert.equal(route.config?.api?.bodyParser, false);
  assert.equal(typeof route.default, "function");
  assert.match(source, /createAwdpApiHandler\(["']contact["']\)/);
  assert.doesNotMatch(source, /sendFormEmail/);
});
