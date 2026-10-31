import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { SEED_PRODUCTS, SEED_SETTINGS } from '../shared/seed.js';
import { EMPTY_CART, cartReducer, summariseCart } from '../src/lib/cart.js';
import {
  addPair,
  filled,
  fitToSize,
  rankFlavours,
  removePair,
  suggestBox,
} from '../src/lib/flavourFinder.js';
import { messages } from '../src/i18n/messages.js';

const foxnuts = SEED_PRODUCTS.filter((p) => p.bundleEligible);
const byId = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
const bundles = new Map(SEED_SETTINGS.bundles.map((b) => [b.id, b]));
const ctx = {
  resolveProduct: (id) => byId.get(id) ?? null,
  resolveBundle: (id) => bundles.get(id) ?? null,
  shippingRates: SEED_SETTINGS.shipping,
  lang: 'de',
};

test('flavour finder fills a box of 8 with four flavours, two each', () => {
  const picks = suggestBox(rankFlavours(foxnuts, { spice: 0, taste: 'cheese' }), 8);
  assert.equal(filled(picks), 8);
  assert.equal(Object.keys(picks).length, 4);
  assert.ok(Object.values(picks).every((q) => q === 2));
  assert.ok(
    picks['four-cheese'] && picks['cheese-herbs'],
    'cheesy answers rank cheese flavours first',
  );
});

test('flavour finder fills a box of 16 even with only seven flavours', () => {
  const picks = suggestBox(rankFlavours(foxnuts, { spice: 2, taste: 'savoury' }), 16);
  assert.equal(filled(picks), 16);
  assert.ok(Object.values(picks).every((q) => q % 2 === 0));
  assert.equal(picks['peri-peri'], 4, 'top match gets the extra pair');
});

test('pairs can be added and removed, never overfilling', () => {
  let picks = {};
  for (let i = 0; i < 6; i += 1) picks = addPair(picks, 'peri-peri', 8);
  assert.equal(filled(picks), 8);
  picks = removePair(picks, 'peri-peri');
  assert.equal(picks['peri-peri'], 6);
  assert.equal(filled(fitToSize({ a: 6, b: 6, c: 4 }, 8)), 8);
});

test('cart: boxes and single items price correctly per country', () => {
  let state = cartReducer(EMPTY_CART, { type: 'add', id: 'peri-peri', amount: 2 });
  const picks = ['cream-onion', 'peri-peri', 'four-cheese', 'butter-chicken'].map((productId) => ({
    productId,
    quantity: 2,
  }));
  state = cartReducer(state, { type: 'addBox', bundleId: 'box-8', picks });
  state = cartReducer(state, { type: 'addBox', bundleId: 'box-8', picks: [...picks].reverse() });
  assert.equal(state.boxes.length, 1);
  assert.equal(state.boxes[0].quantity, 2);
  let s = summariseCart(state, ctx);
  assert.equal(s.subtotal, 598 + 2 * 2392);
  assert.equal(s.shipping, 499);
  assert.equal(s.count, 2 + 16);
  assert.ok(s.canCheckout);
  state = cartReducer(state, { type: 'country', country: 'GB' });
  s = summariseCart(state, ctx);
  assert.equal(s.shipping, 1199);
});

test('cart flags sold-out items and blocks checkout', () => {
  const state = cartReducer(EMPTY_CART, { type: 'add', id: 'peri-peri', amount: 1 });
  const soldOut = {
    ...ctx,
    resolveProduct: (id) =>
      id === 'peri-peri' ? { ...byId.get(id), inStock: false } : byId.get(id),
  };
  const s = summariseCart(state, soldOut);
  assert.equal(s.lines[0].issue, 'soldOut');
  assert.equal(s.canCheckout, false);
});

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

test('every UI text exists in German and English', () => {
  const de = keys(messages.de).sort();
  const en = keys(messages.en).sort();
  assert.deepEqual(
    de.filter((k) => !en.includes(k)),
    [],
    'missing in English',
  );
  assert.deepEqual(
    en.filter((k) => !de.includes(k)),
    [],
    'missing in German',
  );
});

test('no em/en dashes, "Sattu" or salt/lemon serving tips in shop copy', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|html)$/.test(entry.name)) files.push(full);
    }
  };
  ['src', 'shared', 'server/notifications'].forEach(walk);
  files.push('index.html');
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/[—–]/.test(text), `${file} contains an em or en dash`);
    assert.ok(!/sattu/i.test(text), `${file} mentions Sattu`);
  }
  const protein = JSON.stringify([messages.de.home.ways, messages.en.home.ways]);
  assert.ok(
    !/lemon|zitrone|salt|salz/i.test(protein),
    'protein serving tips mention salt or lemon',
  );
});

test('cart blocks checkout when selected market stock is zero', () => {
  const product = {
    ...SEED_PRODUCTS.find((p) => p.id === 'peri-peri'),
    stockByMarket: { DE: 10, GB: 0 },
  };
  const state = { ...EMPTY_CART, country: 'GB', items: { 'peri-peri': 1 }, boxes: [] };
  const summary = summariseCart(state, {
    resolveProduct: () => product,
    resolveBundle: () => null,
    shippingRates: SEED_SETTINGS.shipping,
    lang: 'en',
  });
  assert.equal(summary.canCheckout, false);
  assert.equal(summary.hasIssues, true);
});
