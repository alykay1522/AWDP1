// tests/ssr.test.mjs
// Tests for artifacts/awdp-site/api/ssr.mjs
// Run with: node --test tests/ssr.test.mjs
// Requires Node >= 20.x

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Template fixture ──────────────────────────────────────────────────────────
const FAKE_TEMPLATE = [
  '<!DOCTYPE html><html>',
  '<head><title>AWDP</title></head>',
  '<body>',
  '<div id="root"></div>',
  '<script type="module" src="/src/main.tsx"></script>',
  '</body></html>',
].join('\n');

// ── Create a temp dir with the template so readTemplate() can find it ─────────
// ssr.mjs resolves SSR_TEMPLATE_PATH ahead of its built-in candidate list.
// chdir alone is NOT enough: two candidates are anchored to __dirname, so once
// artifacts/awdp-site/dist/public exists (i.e. after any `pnpm build`) they
// shadow a cwd-relative fixture and these tests read the real built shell.
const tmpBase = join(tmpdir(), 'awdp-ssr-test-' + Date.now());
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(method, path, extraQuery = {}) {
  return { method, url: path, query: { path, ...extraQuery } };
}

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

async function run(method, path) {
  const req = makeReq(method, path);
  const res = makeRes();
  await handler(req, res);
  return res;
}

/** Temporarily replaces globalThis.fetch, restores it after fn() resolves. */
async function withFetch(impl, fn) {
  const prev = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = prev;
  }
}

const MOCK_PRODUCT = {
  name: 'Vinyl Casement Operator',
  description: 'Replacement single-arm casement window operator.',
  price: 24.99,
  sku: 'WO-CS-001',
  inStock: true,
  imageUrl: 'https://example.com/wo-cs-001.jpg',
  brand: 'Truth Hardware',
};

// ── HTTP method handling ──────────────────────────────────────────────────────

describe('HTTP method handling', () => {
  test('GET / returns 200', async () => {
    const res = await run('GET', '/');
    assert.equal(res.statusCode, 200);
  });

  test('HEAD / returns 200 and calls end() with no body', async () => {
    const res = await run('HEAD', '/');
    assert.equal(res.statusCode, 200);
    assert.equal(res.ended, true, 'end() should be called for HEAD');
    assert.equal(res.body, undefined, 'send() must not be called for HEAD');
  });

  test('POST / returns 405 with Allow header', async () => {
    const res = await run('POST', '/');
    assert.equal(res.statusCode, 405);
    assert.ok(res.body && res.body.error, 'body should include an error field');
    assert.ok(res._headers['Allow'], 'Allow header should be set');
  });

  test('PUT / returns 405', async () => {
    const res = await run('PUT', '/');
    assert.equal(res.statusCode, 405);
  });

  test('DELETE / returns 405', async () => {
    const res = await run('DELETE', '/');
    assert.equal(res.statusCode, 405);
  });
});

// ── Template reading ──────────────────────────────────────────────────────────

describe('Template reading', () => {
  test('returns 500 when template file is missing', async () => {
    renameSync(templatePath, templatePath + '.bak');
    try {
      const res = await run('GET', '/');
      assert.equal(res.statusCode, 500);
    } finally {
      renameSync(templatePath + '.bak', templatePath);
    }
  });
});

// ── Static page metadata ──────────────────────────────────────────────────────

describe('Static page metadata injection', () => {
  test('"/" injects homepage title and canonical link', async () => {
    const res = await run('GET', '/');
    const html = String(res.body);
    assert.equal(res.statusCode, 200);
    assert.ok(html.includes('Window'), 'homepage title injected');
    assert.ok(html.includes('<link rel="canonical"'), 'canonical link injected');
    assert.ok(html.includes('application/ld+json'), 'structured data injected');
  });

  test('"/shop" injects shop page metadata', async () => {
    const res = await run('GET', '/shop');
    assert.equal(res.statusCode, 200);
    assert.ok(String(res.body).includes('4,000+'));
  });

  test('"/contact" injects phone number', async () => {
    const res = await run('GET', '/contact');
    assert.ok(String(res.body).includes('785-533-0244'));
  });

  test('"/about" injects veteran-owned copy', async () => {
    const res = await run('GET', '/about');
    assert.ok(String(res.body).includes('veteran'));
  });

  test('"/guides" injects guides page metadata', async () => {
    const res = await run('GET', '/guides');
    assert.ok(String(res.body).includes('Repair Guides'));
  });

  test('sets long Cache-Control for static pages (s-maxage=3600)', async () => {
    const res = await run('GET', '/shop');
    assert.ok(
      String(res._headers['Cache-Control']).includes('s-maxage=3600'),
      'static pages should get s-maxage=3600',
    );
  });

  test('sets Content-Type text/html', async () => {
    const res = await run('GET', '/');
    assert.ok(String(res._headers['Content-Type']).startsWith('text/html'));
  });
});

// ── Guide page metadata ───────────────────────────────────────────────────────

describe('Guide page metadata', () => {
  test('"/guides/window-balance" resolves guide title', async () => {
    const res = await run('GET', '/guides/window-balance');
    assert.equal(res.statusCode, 200);
    assert.ok(String(res.body).includes('Window Balance'));
  });

  test('"/guides/patio-door-roller" resolves guide title', async () => {
    const res = await run('GET', '/guides/patio-door-roller');
    assert.ok(String(res.body).includes('Patio Door Roller'));
  });

  test('"/guides/weatherstripping" resolves guide title', async () => {
    const res = await run('GET', '/guides/weatherstripping');
    assert.ok(String(res.body).includes('Weatherstripping'));
  });

  test('unknown guide slug "/guides/no-such-guide" serves raw template', async () => {
    const res = await run('GET', '/guides/no-such-guide');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, FAKE_TEMPLATE, 'unknown guide slug should fall through to raw template');
  });
});

// ── Unknown routes ────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  test('unknown route returns 200 with raw template (SPA handles it)', async () => {
    const res = await run('GET', '/some-nonexistent-page-xyz');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, FAKE_TEMPLATE);
  });

  test('"/cart" (SPA route) serves raw template', async () => {
    const res = await run('GET', '/cart');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, FAKE_TEMPLATE);
  });

  test('"/checkout" (SPA route) serves raw template', async () => {
    const res = await run('GET', '/checkout');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, FAKE_TEMPLATE);
  });
});

// ── Product page metadata ─────────────────────────────────────────────────────

describe('Product page metadata', () => {
  test('successful product API fetch injects product name, SKU, and schema', async () => {
    const res = await withFetch(
      async () => ({ ok: true, json: async () => MOCK_PRODUCT }),
      () => run('GET', '/product/WO-CS-001'),
    );
    const html = String(res.body);
    assert.equal(res.statusCode, 200);
    assert.ok(html.includes('Vinyl Casement Operator'), 'product name in rendered HTML');
    assert.ok(html.includes('WO-CS-001'), 'SKU in rendered HTML');
    assert.ok(html.includes('"@type":"Product"'), 'Product schema.org markup present');
    assert.ok(html.includes('24.99'), 'price in structured data');
  });

  test('product page sets short Cache-Control (s-maxage=300)', async () => {
    const res = await withFetch(
      async () => ({ ok: true, json: async () => MOCK_PRODUCT }),
      () => run('GET', '/product/WO-CS-001'),
    );
    assert.ok(
      String(res._headers['Cache-Control']).includes('s-maxage=300'),
      'product pages should get s-maxage=300',
    );
  });

  test('product API 404 returns a real 404, not a soft-404 shell', async () => {
    // ssr.mjs deliberately distinguishes "confirmed not found" (404 from the
    // products API) from "could not reach the API" (network error). Only the
    // latter degrades to a 200 shell; a known-missing SKU must return 404 so
    // search engines do not index it. See ssr.mjs readProduct/injectPage.
    const res = await withFetch(
      async () => ({ ok: false, status: 404, json: async () => ({}) }),
      () => run('GET', '/product/UNKNOWN-SKU'),
    );
    assert.equal(res.statusCode, 404, 'confirmed-missing product must not return a 200 shell');
    assert.equal(String(res.body), FAKE_TEMPLATE, 'serves the raw template for the SPA to render');
  });

  test('product API network error returns 200 with fallback metadata', async () => {
    const res = await withFetch(
      async () => { throw new Error('Network failure'); },
      () => run('GET', '/product/NET-ERR-SKU'),
    );
    assert.equal(res.statusCode, 200, 'network error falls back gracefully');
    assert.ok(String(res.body).includes('NET-ERR-SKU'));
  });

  test('URL-encoded SKU in path is decoded before API fetch', async () => {
    let capturedUrl = '';
    const res = await withFetch(
      async (url) => {
        capturedUrl = url;
        return { ok: true, json: async () => ({ name: 'Encoded Part', price: 9.99, sku: 'MY PART' }) };
      },
      () => run('GET', '/product/MY%20PART'),
    );
    assert.equal(res.statusCode, 200);
    assert.ok(capturedUrl.includes('MY'), 'decoded SKU appears in fetch URL');
  });

  test('"/product/" with no SKU serves raw template', async () => {
    // normalizePath strips trailing slash: "/product/" -> "/product"
    // "/product" does not match startsWith("/product/") so productMetadata returns null
    const res = await run('GET', '/product/');
    assert.equal(res.body, FAKE_TEMPLATE, 'empty product path should fall through to raw template');
  });
});

// ── HTML security ─────────────────────────────────────────────────────────────

describe('HTML security', () => {
  test('HTML-escapes special characters in product metadata', async () => {
    const res = await withFetch(
      async () => ({
        ok: true,
        json: async () => ({
          name: '<script>alert("xss")</script>',
          description: 'Safe',
          price: 10,
          sku: 'XSS-001',
        }),
      }),
      () => run('GET', '/product/XSS-001'),
    );
    const html = String(res.body);
    assert.ok(
      !html.includes('<script>alert('),
      'unescaped script tag must not appear in HTML output',
    );
    assert.ok(html.includes('&lt;script&gt;'), 'angle brackets must be HTML-escaped');
  });
});
