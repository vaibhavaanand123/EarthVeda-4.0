import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localiseProduct } from '../shared/catalog.js';
import { formatMoney, isValidPostcode, normalisePostcode, toE164 } from '../shared/markets.js';
import { canSetManually, canTransition } from '../shared/orderStatus.js';
import { QuoteError, allocate, boxKey, quoteBasket, unitPricePerKg } from '../shared/pricing.js';
import { matchRoute, path } from '../shared/routes.js';
import { SEED_PRODUCTS, SEED_SETTINGS } from '../shared/seed.js';

const byId = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
const bundles = new Map(SEED_SETTINGS.bundles.map((b) => [b.id, b]));
const ctx = (country = 'DE', overrides = {}) => ({
  country,
  lang: 'en',
  resolveProduct: (id) => overrides[id] ?? byId.get(id) ?? null,
  resolveBundle: (id) => bundles.get(id) ?? null,
  shippingRates: SEED_SETTINGS.shipping,
});
const four = ['cream-onion', 'peri-peri', 'four-cheese', 'butter-chicken'];
const box8 = {
  bundleId: 'box-8',
  quantity: 1,
  picks: four.map((productId) => ({ productId, quantity: 2 })),
};

test('single foxnut pouch costs 2,99 € and ships for 4,99 € in Germany', () => {
  const q = quoteBasket({ items: [{ productId: 'peri-peri', quantity: 1 }] }, ctx('DE'));
  assert.equal(q.subtotal, 299);
  assert.equal(q.shipping, 499);
  assert.equal(q.total, 798);
  assert.equal(formatMoney(q.subtotal, 'de').replace(/\s/g, ' '), '2,99 €');
  assert.equal(formatMoney(q.subtotal, 'en'), '€2.99');
});

test('UK shipping is 11,99 €', () => {
  const q = quoteBasket({ items: [{ productId: 'peri-peri', quantity: 2 }] }, ctx('GB'));
  assert.equal(q.shipping, 1199);
  assert.equal(q.total, 598 + 1199);
});

test('box of 8 costs 23,92 € and box of 16 costs 47,84 €', () => {
  const q8 = quoteBasket({ boxes: [box8] }, ctx());
  assert.equal(q8.subtotal, 2392);
  assert.equal(q8.itemCount, 8);
  const box16 = {
    bundleId: 'box-16',
    quantity: 1,
    picks: [...four, 'cheese-herbs', 'pink-salt-pepper', 'asian-pepper-garlic'].map(
      (productId, i) => ({
        productId,
        quantity: i === 0 ? 4 : 2,
      }),
    ),
  };
  const q16 = quoteBasket({ boxes: [box16] }, ctx());
  assert.equal(q16.subtotal, 4784);
  assert.equal(
    q16.lines[0].picks.reduce((n, p) => n + p.quantity, 0),
    16,
  );
});

test('identical boxes merge into one line', () => {
  const q = quoteBasket({ boxes: [box8, { ...box8, picks: [...box8.picks].reverse() }] }, ctx());
  assert.equal(q.lines.length, 1);
  assert.equal(q.lines[0].quantity, 2);
  assert.equal(boxKey('box-8', box8.picks), boxKey('box-8', [...box8.picks].reverse()));
});

test('boxes must be complete and foxnuts only', () => {
  assert.throws(
    () => quoteBasket({ boxes: [{ ...box8, picks: box8.picks.slice(1) }] }, ctx()),
    (e) => e instanceof QuoteError && e.code === 'box_incomplete',
  );
  const withProtein = {
    ...box8,
    picks: [...box8.picks.slice(1), { productId: 'protein-mango', quantity: 2 }],
  };
  assert.throws(
    () => quoteBasket({ boxes: [withProtein] }, ctx()),
    (e) => e.code === 'not_in_box',
  );
});

test('sold out or hidden products cannot be bought', () => {
  const soldOut = { ...byId.get('peri-peri'), inStock: false };
  assert.throws(
    () =>
      quoteBasket(
        { items: [{ productId: 'peri-peri', quantity: 1 }] },
        ctx('DE', { 'peri-peri': soldOut }),
      ),
    (e) => e.code === 'out_of_stock',
  );
  const hidden = { ...byId.get('peri-peri'), active: false };
  assert.throws(
    () =>
      quoteBasket(
        { items: [{ productId: 'peri-peri', quantity: 1 }] },
        ctx('DE', { 'peri-peri': hidden }),
      ),
    (e) => e.code === 'unavailable',
  );
});

test('VAT is included per rate and shipping follows the goods', () => {
  const q = quoteBasket({ items: [{ productId: 'peri-peri', quantity: 1 }] }, ctx('DE'));
  assert.equal(q.vat.length, 1);
  assert.equal(q.vat[0].rate, 7);
  assert.equal(q.vat[0].gross, 798);
  assert.equal(q.vat[0].amount, Math.round((798 * 7) / 107));
  const mixed = quoteBasket(
    { items: [{ productId: 'peri-peri', quantity: 1 }] },
    ctx('DE', { 'peri-peri': { ...byId.get('peri-peri'), vat: { DE: 19, GB: 20 } } }),
  );
  assert.equal(mixed.vat[0].rate, 19);
});

test('allocate splits cents exactly', () => {
  for (const [total, weights] of [
    [2392, [299, 299, 299]],
    [1, [1, 1, 1]],
    [499, [2392, 1499]],
  ]) {
    const parts = allocate(total, weights);
    assert.equal(
      parts.reduce((a, b) => a + b, 0),
      total,
    );
  }
});

test('rejects unknown countries and empty bags', () => {
  assert.throws(
    () => quoteBasket({ items: [] }, ctx('DE')),
    (e) => e.code === 'empty_cart',
  );
  assert.throws(
    () => quoteBasket({ items: [{ productId: 'peri-peri', quantity: 1 }] }, ctx('US')),
    (e) => e.code === 'invalid_country',
  );
});

test('addresses and phones are normalised per country', () => {
  assert.equal(normalisePostcode('sw1a1aa', 'GB'), 'SW1A 1AA');
  assert.ok(isValidPostcode('ec1v 9hx', 'GB'));
  assert.ok(!isValidPostcode('1234', 'DE'));
  assert.equal(toE164('0151 2345 6789', 'DE'), '+4915123456789');
  assert.equal(toE164('07700 900123', 'GB'), '+447700900123');
  assert.equal(toE164('+44 7700 900123', 'DE'), '+447700900123');
  assert.equal(toE164('abc', 'DE'), '');
});

test('order status rules', () => {
  assert.ok(canTransition('pending_payment', 'paid'));
  assert.ok(!canTransition('delivered', 'processing'));
  assert.ok(canSetManually('paid', 'processing'));
  assert.ok(!canSetManually('pending_payment', 'paid'), 'only the payment provider can mark paid');
});

test('localised routes round-trip', () => {
  assert.equal(path('product', 'en', { slug: 'peri-peri' }), '/en/product/peri-peri');
  assert.deepEqual(matchRoute('/produkt/peri-peri'), {
    key: 'product',
    lang: 'de',
    params: { slug: 'peri-peri' },
  });
  assert.equal(matchRoute('/en')?.key, 'home');
});

test('catalogue copy rules: no "Sattu", no salt or lemon on protein, no dashes', () => {
  const text = JSON.stringify([SEED_PRODUCTS, SEED_SETTINGS]);
  assert.ok(!/sattu/i.test(text), 'Sattu must not appear');
  assert.ok(!/[—–]/.test(text), 'no em or en dashes');
  for (const p of SEED_PRODUCTS.filter((x) => x.range === 'protein'))
    assert.ok(
      !/salt|salz|lemon|zitrone/i.test(JSON.stringify(p.i18n)),
      `${p.id} mentions salt/lemon`,
    );
  for (const p of SEED_PRODUCTS) {
    const l = localiseProduct(p, 'de');
    assert.ok(l.name && l.fullName && l.description);
  }
});

test('unit price per kg', () => {
  assert.equal(unitPricePerKg(299, 70), 4271);
  assert.equal(unitPricePerKg(299, null), null);
});
