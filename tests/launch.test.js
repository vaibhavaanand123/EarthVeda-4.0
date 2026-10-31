import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CATALOG_PRICES } from '../shared/catalog.js';
import { quoteBasket } from '../shared/pricing.js';
import { SEED_PRODUCTS, SEED_SETTINGS } from '../shared/seed.js';
import { assertConnectedBuild } from '../server/lib/buildReadiness.js';
import { createOrderService } from '../server/services/orderService.js';
import { PREVIEW_STORE } from '../src/content/previewStore.js';
import { EMPTY_CART, summariseCart } from '../src/lib/cart.js';

const products = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
const context = {
  resolveProduct: (id) => products.get(id),
  resolveBundle: (id) => SEED_SETTINGS.bundles.find((b) => b.id === id),
  shippingRates: SEED_SETTINGS.shipping,
  lang: 'en',
};

test('every Plant Protein flavour is 1499 cents in preview and seed; quantities and market totals match', () => {
  assert.equal(CATALOG_PRICES.protein, 1499);
  for (const p of SEED_PRODUCTS.filter((p) => p.range === 'protein')) {
    assert.equal(p.price, 1499);
    assert.equal(PREVIEW_STORE.products.find((v) => v.id === p.id).price, p.price);
    for (const [country, fee] of [
      ['DE', 499],
      ['GB', 1199],
    ]) {
      const quote = quoteBasket(
        { items: [{ productId: p.id, quantity: 2, price: 1 }] },
        { ...context, country },
      );
      assert.equal(quote.lines[0].unitPrice, 1499);
      assert.equal(quote.subtotal, 2998);
      assert.equal(quote.total, 2998 + fee);
      assert.equal(
        quote.vat.reduce((sum, v) => sum + v.gross, 0),
        quote.total,
      );
    }
  }
});

test('mixed basket preserves foxnut box price and charges protein separately', () => {
  const quote = quoteBasket(
    {
      items: [{ productId: 'protein-chocolate', quantity: 3 }],
      boxes: [{ bundleId: 'box-8', quantity: 1, picks: [{ productId: 'peri-peri', quantity: 8 }] }],
    },
    { ...context, country: 'DE' },
  );
  assert.equal(quote.subtotal, 2392 + 3 * 1499);
  assert.equal(quote.total, 2392 + 3 * 1499 + 499);
});

test('missing saved products remain removable and block checkout', () => {
  const summary = summariseCart(
    { ...EMPTY_CART, items: { discontinued: 1, 'protein-mango': 1 } },
    context,
  );
  assert.equal(summary.lines.length, 2);
  assert.equal(summary.lines.find((l) => l.id === 'discontinued').issue, 'gone');
  assert.equal(summary.canCheckout, false);
});

test('stock limits account for the same SKU in a box and as single packs', () => {
  const summary = summariseCart(
    {
      ...EMPTY_CART,
      items: { 'peri-peri': 1 },
      boxes: [
        {
          key: 'mix',
          bundleId: 'box-8',
          quantity: 1,
          picks: [{ productId: 'peri-peri', quantity: 8 }],
        },
      ],
    },
    {
      ...context,
      resolveProduct: (id) => ({ ...products.get(id), stockByMarket: { DE: 8, GB: 0 } }),
    },
  );
  assert.equal(summary.canCheckout, false);
  assert.ok(summary.lines.every((l) => l.issue === 'stockLimit'));
});

test('stale displayed prices stop checkout before reserving stock or creating a payment', async () => {
  let inserted = false;
  const service = createOrderService({
    orderRepository: {
      findByIdempotencyKey: async () => null,
      insert: async () => {
        inserted = true;
      },
    },
    catalogService: {
      refresh: async () => {},
      resolveProduct: (id) => ({ ...products.get(id), stockByMarket: { DE: 10 } }),
      resolveBundle: context.resolveBundle,
      shippingRates: () => context.shippingRates,
    },
    config: { gbPostcodeAreas: [] },
  });
  await assert.rejects(
    service.startCheckout(
      {
        country: 'DE',
        lang: 'en',
        items: [{ productId: 'protein-mango', quantity: 1 }],
        expectedTotal: 798,
      },
      { idempotencyKey: 'stale' },
    ),
    (e) => e.code === 'price_changed',
  );
  assert.equal(inserted, false);
});

test('production build guard rejects a preview or missing build and accepts a connected build', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ev-build-'));
  try {
    await assert.rejects(assertConnectedBuild(dir), /metadata is missing/);
    await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html>');
    await fs.writeFile(
      path.join(dir, 'build-info.json'),
      JSON.stringify({ commerceMode: 'preview' }),
    );
    await assert.rejects(assertConnectedBuild(dir), /preview checkout/);
    await fs.writeFile(
      path.join(dir, 'build-info.json'),
      JSON.stringify({ commerceMode: 'connected' }),
    );
    await assertConnectedBuild(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
