import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import handler, {
  fetchMetadata,
  isBotUserAgent,
  normalizePath,
  readTemplate,
  resolveApiBase,
} from "../api/ssr.mjs";

test("detects crawlers and normalizes rewritten paths", () => {
  assert.equal(isBotUserAgent("Googlebot/2.1"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0"), false);
  assert.equal(normalizePath("shop"), "/shop");
  assert.equal(normalizePath("/shop/"), "/shop");
});

test("resolves same-origin API from request host", () => {
  assert.equal(
    resolveApiBase({ headers: { host: "example.com", "x-forwarded-proto": "https" } }),
    "https://example.com/api",
  );
});

test("product metadata encodes SKU and handles API success/failure", async () => {
  let requested = "";
  const success = await fetchMetadata("/product/A/B", "https://example.com/api", {
    fetchImpl: async (url) => {
      requested = url;
      return { ok: true, json: async () => ({ name: "Test Part", price: 5 }) };
    },
  });
  assert.equal(requested, "https://example.com/api/products/A%2FB");
  assert.match(success.title, /Test Part/);

  const fallback = await fetchMetadata("/product/MISSING", "https://example.com/api", {
    fetchImpl: async () => ({ ok: false }),
  });
  assert.match(fallback.title, /MISSING/);
});

test("reads an HTML template", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "awdp-ssr-"));
  const template = path.join(dir, "index.html");
  await writeFile(template, "<html><head><title>x</title></head><body></body></html>");
  assert.match(readTemplate(template), /<title>x<\/title>/);
});

test("rejects unsupported methods before reading the template", async () => {
  const response = mockResponse();
  await handler({ method: "POST", headers: {}, query: {} }, response);
  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: "Method not allowed" });
});

test("does not classify a non-public bot path as SSR metadata", async () => {
  const metadata = await fetchMetadata("/admin/login", "https://example.com/api", {
    fetchImpl: async () => { throw new Error("should not fetch"); },
  });
  assert.equal(metadata, null);
});

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; },
  };
}
