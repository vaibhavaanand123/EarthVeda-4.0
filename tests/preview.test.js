import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PREVIEW_STORE } from '../src/content/previewStore.js';
import { refreshCopy } from '../src/content/refreshCopy.js';
import {
  exampleAddress,
  validNewsletter,
  validPreviewAddress,
} from '../src/lib/previewCheckout.js';
import { EMPTY_CART, cartReducer, isCartState, summariseCart } from '../src/lib/cart.js';

test('preview uses the same range prices as the live seed: foxnuts 299, Plant Protein 1499 cents', () => {
  assert.equal(PREVIEW_STORE.products.length, 10);
  assert.ok(
    PREVIEW_STORE.products.filter((p) => p.range === 'foxnuts').every((p) => p.price === 299),
  );
  assert.equal(PREVIEW_STORE.products.filter((p) => p.range === 'protein').length, 3);
  assert.ok(
    PREVIEW_STORE.products.filter((p) => p.range === 'protein').every((p) => p.price === 1499),
  );
  assert.deepEqual(
    PREVIEW_STORE.bundles.map((b) => b.price),
    [2392, 4784],
  );
  assert.equal(PREVIEW_STORE.shipping.DE.fee, 499);
  assert.equal(PREVIEW_STORE.shipping.GB.fee, 1199);
});

test('preview basket calculates 8 and 16 packs with exact German and UK delivery', () => {
  const products = new Map(PREVIEW_STORE.products.map((p) => [p.id, p]));
  const picks = ['cream-onion', 'peri-peri', 'four-cheese', 'butter-chicken'].map((productId) => ({
    productId,
    quantity: 2,
  }));
  const ctx = {
    resolveProduct: (id) => products.get(id),
    resolveBundle: (id) => PREVIEW_STORE.bundles.find((b) => b.id === id),
    shippingRates: PREVIEW_STORE.shipping,
    lang: 'en',
  };
  const state = cartReducer(EMPTY_CART, { type: 'addBox', bundleId: 'box-8', picks });
  assert.equal(summariseCart(state, ctx).total, 2891);
  assert.equal(summariseCart({ ...state, country: 'GB' }, ctx).total, 3591);
  const large = cartReducer(EMPTY_CART, {
    type: 'addBox',
    bundleId: 'box-16',
    picks: picks.map((p) => ({ ...p, quantity: 4 })),
  });
  assert.equal(summariseCart(large, ctx).total, 5283);
  assert.equal(summariseCart({ ...large, country: 'GB' }, ctx).total, 5983);
});

test('demo checkout validates country-specific postcodes and malformed addresses', () => {
  assert.equal(validPreviewAddress(exampleAddress('DE'), 'DE'), true);
  assert.equal(validPreviewAddress(exampleAddress('GB'), 'GB'), true);
  for (const [form, country] of [
    [exampleAddress('GB'), 'DE'],
    [exampleAddress('DE'), 'GB'],
    [exampleAddress('DE'), 'XX'],
    [null, 'DE'],
    [{ ...exampleAddress('DE'), email: 'bad' }, 'DE'],
    [{ ...exampleAddress('DE'), street: '' }, 'DE'],
    [{ ...exampleAddress('DE'), firstName: 42 }, 'DE'],
  ])
    assert.equal(validPreviewAddress(form, country), false);
});

test('newsletter requires explicit consent and rejects invalid or excessive addresses', () => {
  assert.equal(validNewsletter(' hello@example.com ', true), true);
  assert.equal(validNewsletter('hello@example.com', false), false);
  assert.equal(validNewsletter('not-an-email', true), false);
  assert.equal(validNewsletter('a'.repeat(250) + '@example.com', true), false);
});

test('cart input validation rejects malformed data and quantities stay capped', () => {
  assert.equal(Boolean(isCartState({ items: [], boxes: [], country: 'DE' })), false);
  assert.equal(Boolean(isCartState({ items: {}, boxes: [null], country: 'DE' })), false);
  assert.equal(Boolean(isCartState(null)), false);
  assert.equal(Boolean(isCartState({ items: { a: Infinity }, boxes: [], country: 'DE' })), false);
  assert.equal(Boolean(isCartState({ items: { a: 1 }, boxes: [], country: 'XX' })), false);
  const cart = cartReducer(EMPTY_CART, { type: 'add', id: 'peri-peri', amount: 1 });
  assert.equal(
    cartReducer(cart, { type: 'set', id: 'peri-peri', quantity: 1000 }).items['peri-peri'],
    20,
  );
  assert.deepEqual(cartReducer(cart, { type: 'country', country: 'XX' }), cart);
  assert.deepEqual(cartReducer(cart, { type: 'add', id: 'peri-peri', amount: NaN }), cart);
});

function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}
test('redesign copy has matching German and English keys without forbidden dashes', () => {
  assert.deepEqual(keys(refreshCopy.de).sort(), keys(refreshCopy.en).sort());
  assert.equal(/[—–]/.test(JSON.stringify(refreshCopy)), false);
});
