import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contactRoutePath = path.resolve(__dirname, "../api/contact.js");

test("/api/contact Vercel entrypoint delegates to the shared Express API", async () => {
  const source = await readFile(contactRoutePath, "utf8");

  assert.match(source, /createAwdpApiHandler/);
  assert.match(source, /bodyParser:\s*false/);
  assert.doesNotMatch(source, /sendFormEmail/);
});
