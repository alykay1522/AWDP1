// tests/product-url.test.mjs
// Guards the product URL contract: a SKU containing "/" must never reach a
// route as an encoded slash, because Vercel and Express both decode %2F back
// to "/" before matching and the request then matches nothing.
// Run with: node --test tests/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as site from '../artifacts/awdp-site/src/lib/product-url.mjs';
import * as api from '../artifacts/api-server/src/lib/productUrl.mjs';

/**
 * Real shapes from the production catalog. The first group is the 72 SKUs that
 * contain a slash (each of these 404'd before this fix); the second is ordinary
 * SKUs, which must come through byte-identical so no indexed URL changes.
 */
const SLASH_SKUS = [
  'AWDP-TA-OI/6735',
  'AWDP-PA-PR-8S/CHROME',
  'AWDP-Mun-MPP-2PL/RP-6N',
  'AWDP-Sash Locks Keeper 108400 13 / 14',
  'AWDP-L-RPF/DR15 1 1/4"',
  'AWDP-Model PD-RR-38DD 1 /58"',
  'AWDP-D/H S/H Balance Parts',
  'AWDP-6 9/16" Holes| PO-OBF-WHT',
  'AWDP-Patio Door Handleset PO-III-W/BZ/SLV',
];

const PLAIN_SKUS = [
  'AWDP-EE-PILF',
  'AWDP-OT-RRA-B',
  'AWDP-Color Coded Balance Pairs',
  'AWDP-Narrow Seals',
  'AWDP-Norco Parts-268bda',
  'AWDP-BCS-1.5',
];

describe('productSlug', () => {
  test('replaces every path separator', () => {
    for (const sku of SLASH_SKUS) {
      const slug = site.productSlug(sku);
      assert.ok(!slug.includes('/'), `${sku} -> ${slug} still has a slash`);
      assert.ok(!slug.includes('\\'), `${sku} -> ${slug} still has a backslash`);
    }
  });

  test('leaves every other SKU untouched', () => {
    for (const sku of PLAIN_SKUS) {
      assert.equal(site.productSlug(sku), sku);
    }
  });

  test('collapses a run of separators into one hyphen', () => {
    assert.equal(site.productSlug('A//B'), 'A-B');
    assert.equal(site.productSlug('A/\\B'), 'A-B');
  });

  test('tolerates null and undefined', () => {
    assert.equal(site.productSlug(null), '');
    assert.equal(site.productSlug(undefined), '');
  });
});

describe('productPath', () => {
  test('never emits a slash after /product/, raw or encoded', () => {
    for (const sku of [...SLASH_SKUS, ...PLAIN_SKUS]) {
      const segment = site.productPath(sku).slice('/product/'.length);
      assert.ok(!segment.includes('/'), `${sku} produced a bare slash`);
      assert.ok(
        !/%2f/i.test(segment),
        `${sku} produced an encoded slash — Vercel and Express decode it back before routing`,
      );
    }
  });

  test('encodes the rest of the SKU', () => {
    assert.equal(site.productPath('AWDP-TA-OI/6735'), '/product/AWDP-TA-OI-6735');
    assert.equal(
      site.productPath('AWDP-Color Coded Balance Pairs'),
      '/product/AWDP-Color%20Coded%20Balance%20Pairs',
    );
  });

  test('is stable — running it on its own output changes nothing', () => {
    for (const sku of [...SLASH_SKUS, ...PLAIN_SKUS]) {
      const slug = site.productSlug(sku);
      assert.equal(site.productSlug(slug), slug);
    }
  });
});

describe('storefront and API copies agree', () => {
  test('identical output for every fixture', () => {
    for (const sku of [...SLASH_SKUS, ...PLAIN_SKUS, '', null, undefined]) {
      assert.equal(api.productSlug(sku), site.productSlug(sku), `productSlug drifted on ${sku}`);
      assert.equal(api.productPath(sku), site.productPath(sku), `productPath drifted on ${sku}`);
    }
  });
});
