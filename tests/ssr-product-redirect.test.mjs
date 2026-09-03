// tests/ssr-product-redirect.test.mjs
// Legacy product URLs built from a raw SKU.
//
// Product links used to be `/product/${encodeURIComponent(sku)}`, so the 72
// catalog SKUs containing a slash shipped as %2F. Vercel decodes %2F back to
// "/" before the SSR function runs, so those requests arrive with an extra
// path segment and match no product — a 404 on a live product, and one that
// is still sitting in the sitemap and in Google's index. They now get a
// permanent redirect to the slug form.
//
// Run with: node --test tests/ssr-product-redirect.test.mjs

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FAKE_TEMPLATE = [
  '<!DOCTYPE html><html>',
  '<head><title>AWDP</title></head>',
  '<body>',
  '<div id="root"></div>',
  '<script type="module" src="/src/main.tsx"></script>',
  '</body></html>',
].join('\n');

const tmpBase = join(tmpdir(), 'awdp-redirect-test-' + Date.now());
const templatePath = join(tmpBase, 'dist', 'public', 'index.html');
mkdirSync(join(tmpBase, 'dist', 'public'), { recursive: true });
writeFileSync(templatePath, FAKE_TEMPLATE, 'utf8');

const originalCwd = process.cwd();
process.env.SSR_TEMPLATE_PATH = templatePath;
process.chdir(tmpBase);

const { default: handler } = await import('../artifacts/awdp-site/api/ssr.mjs');

after(() => {
  delete process.env.SSR_TEMPLATE_PATH;
  process.chdir(originalCwd);
  rmSync(tmpBase, { recursive: true, force: true });
});

function makeRes() {
  return {
    statusCode: null,
    _headers: {},
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    json(data) { this.body = data; return this; },
    send(data) { this.body = data; return this; },
    end() { this.ended = true; return this; },
  };
}

async function run(path) {
  const res = makeRes();
  await handler({ method: 'GET', url: path, query: { path } }, res);
  return res;
}

/** Temporarily replaces globalThis.fetch, restores it after fn() resolves. */
async function withProduct(product, fn) {
  const prev = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => product });
  try {
    return await fn();
  } finally {
    globalThis.fetch = prev;
  }
}

const MOCK_PRODUCT = {
  name: 'Glazing Channel',
  description: 'Black glazing channel for 1/4" thick glass.',
  price: 98.88,
  sku: 'AWDP-TA-OI/6735',
  inStock: true,
  imageUrl: 'https://example.com/glazing.png',
};

describe('Legacy product URL redirects', () => {
  test('a decoded slash SKU redirects permanently to the slug form', async () => {
    const res = await run('/product/AWDP-TA-OI/6735');
    assert.equal(res.statusCode, 301);
    assert.equal(res._headers.Location, '/product/AWDP-TA-OI-6735');
  });

  test('a multi-slash SKU collapses every separator', async () => {
    const res = await run('/product/AWDP-D/H S/H Balance Parts');
    assert.equal(res.statusCode, 301);
    assert.equal(
      res._headers.Location,
      '/product/' + encodeURIComponent('AWDP-D-H S-H Balance Parts'),
    );
  });

  test('a SKU containing a space does NOT redirect', async () => {
    // Vercel hands this function the decoded path every time, so redirecting
    // an ordinary SKU to its encoded form would loop forever.
    const res = await withProduct(
      { ...MOCK_PRODUCT, sku: 'AWDP-Color Coded Balance Pairs' },
      () => run('/product/AWDP-Color Coded Balance Pairs'),
    );
    assert.notEqual(res.statusCode, 301);
  });

  test('an ordinary SKU does NOT redirect', async () => {
    const res = await withProduct(
      { ...MOCK_PRODUCT, sku: 'AWDP-EE-PILF' },
      () => run('/product/AWDP-EE-PILF'),
    );
    assert.notEqual(res.statusCode, 301);
  });

  test('the canonical URL of a slash SKU is the slug form', async () => {
    const res = await withProduct(MOCK_PRODUCT, () => run('/product/AWDP-TA-OI-6735'));
    assert.equal(res.statusCode, 200);
    assert.ok(
      res.body.includes('<link rel="canonical" href="https://www.allwindowdoorparts.com/product/AWDP-TA-OI-6735" />'),
      'canonical still points at the 404 form',
    );
    assert.ok(!/%2F/i.test(res.body), 'an encoded slash survived into the rendered head');
  });
});
