import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body></body></html>', {
  url: 'https://earthveda.example/en',
  pretendToBeVisual: true,
});
const { document } = dom.window;
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'HTMLInputElement',
  'Node',
  'MutationObserver',
  'getComputedStyle',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'FormData',
])
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: dom.window[key],
  });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.matchMedia = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
});
let requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  requests.push(args);
  throw new Error('Unexpected preview network request');
};

const React = await import('react');
const { render, screen, within, cleanup, fireEvent, waitFor } =
  await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const App = (await import('../src/App.jsx')).default;
const ProductImage = (await import('../src/components/ProductImage.jsx')).default;
const user = () => userEvent.setup({ document: dom.window.document });
const mount = (path = '/en') => {
  dom.window.history.replaceState({}, '', path);
  return render(React.createElement(App));
};
beforeEach(() => {
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  requests = [];
});
afterEach(() => {
  cleanup();
  assert.equal(
    requests.length,
    0,
    'standalone preview must never call an order, payment or newsletter API',
  );
});
after(() => {
  globalThis.fetch = originalFetch;
  dom.window.close();
});

test('missing product images recover again after changing the selected flavour', () => {
  const product = {
    range: 'protein',
    image: '/images/unavailable-one.webp',
    fullName: 'Preview product',
  };
  const view = render(React.createElement(ProductImage, { product }));
  const img = screen.getByRole('img', { name: 'Preview product' });
  fireEvent.error(img);
  assert.ok(img.src.endsWith('/images/product-fallback.svg'));
  view.rerender(
    React.createElement(ProductImage, {
      product: { ...product, image: '/images/unavailable-two.webp' },
    }),
  );
  fireEvent.error(img);
  assert.ok(img.src.endsWith('/images/product-fallback.svg'));
});

test('homepage renders instantly without the API and the header switches German/English', async () => {
  mount();
  const u = user();
  assert.match(screen.getByRole('heading', { level: 1 }).textContent, /Little bites/);
  await u.click(screen.getByRole('link', { name: 'Auf Deutsch wechseln' }));
  assert.match(screen.getByRole('heading', { level: 1 }).textContent, /Kleiner Snack/);
  assert.equal(document.documentElement.lang, 'de');
  await u.click(screen.getByRole('link', { name: 'Switch to English' }));
  assert.equal(document.documentElement.lang, 'en');
});

test('quiz builds four pairs, allows adjustments, adds a box and recalculates UK shipping', async () => {
  mount();
  const u = user();
  const quiz = within(document.getElementById('flavour-finder'));
  await u.click(quiz.getByRole('button', { name: 'Let’s go' }));
  await u.click(quiz.getByRole('button', { name: /Box of 8/ }));
  await u.click(quiz.getByRole('button', { name: 'Mild & creamy' }));
  await u.click(quiz.getByRole('button', { name: 'Cheesy' }));
  assert.match(quiz.getByRole('status').textContent, /8 of 8 packs/);
  await u.click(quiz.getByRole('button', { name: /Add box to bag/ }));
  const drawer = within(screen.getByRole('dialog'));
  assert.match(drawer.getByRole('heading').textContent, /8/);
  assert.match(screen.getByRole('dialog').textContent, /28[.,]91/);
  await u.selectOptions(drawer.getByRole('combobox'), 'GB');
  assert.match(screen.getByRole('dialog').textContent, /35[.,]91/);
  const stored = JSON.parse(dom.window.localStorage.getItem('earthveda-cart-v3'));
  assert.equal(stored.boxes.length, 1);
  assert.equal(stored.boxes[0].picks.length, 4);
  assert.ok(stored.boxes[0].picks.every((p) => p.quantity === 2));
});

test('basket to demo checkout validates input, selects PayPal and completes without saving PII', async () => {
  mount();
  const u = user();
  const products = within(document.querySelector('.discovery'));
  await u.click(products.getByRole('button', { name: /Add to bag:.*Peri Peri/i }));
  await u.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Checkout' }));
  await screen.findByRole('heading', { name: 'Meet the checkout.' });
  const main = within(screen.getByRole('main'));
  await u.click(main.getByRole('button', { name: 'Review the preview' }));
  assert.ok(main.getByRole('alert'));
  await u.click(main.getByRole('button', { name: 'Fill with example details' }));
  await u.click(main.getByRole('radio', { name: 'PayPal' }));
  await u.click(main.getByRole('checkbox', { name: /demonstration checkout/ }));
  await u.click(main.getByRole('button', { name: 'Review the preview' }));
  await u.click(main.getByRole('button', { name: 'Complete demo checkout' }));
  await screen.findByRole('heading', { name: 'Your little ritual, all wrapped up.' });
  assert.match(
    screen.getByRole('main').textContent,
    /No real order, payment or confirmation email/,
  );
  for (const storage of [dom.window.localStorage, dom.window.sessionStorage])
    for (let i = 0; i < storage.length; i++)
      assert.doesNotMatch(
        storage.getItem(storage.key(i)),
        /hello@example.com|Example Street|Beispielstraße/,
      );
});

test('newsletter rejects invalid consent and clearly reports preview instead of a fake subscription', async () => {
  mount();
  const u = user();
  const newsletter = within(document.querySelector('.newsletter'));
  await u.click(newsletter.getByRole('button', { name: 'Count me in' }));
  assert.ok(newsletter.getByRole('alert'));
  await u.type(newsletter.getByRole('textbox'), 'friend@example.com');
  await u.click(newsletter.getByRole('checkbox'));
  await u.click(newsletter.getByRole('button', { name: 'Count me in' }));
  assert.match(newsletter.getByRole('status').textContent, /not saved or sent/);
  assert.doesNotMatch(dom.window.localStorage.getItem('earthveda-cart-v3'), /friend@example.com/);
});

test('malformed saved cart recovers, search resolves products and unknown routes have a recovery link', async () => {
  dom.window.localStorage.setItem('earthveda-cart-v3', '{broken');
  mount();
  const u = user();
  await u.click(screen.getByRole('button', { name: 'Search' }));
  await u.type(screen.getByRole('searchbox'), 'mango');
  fireEvent.submit(screen.getByRole('search'));
  await screen.findByRole('heading', { name: /mango/i, level: 1 });
  assert.match(screen.getByRole('main').textContent, /Mango/);
  cleanup();
  mount('/en/this-route-does-not-exist');
  await screen.findByRole('heading', { name: 'Page not found' });
  assert.ok(within(screen.getByRole('main')).getByRole('link', { name: 'Go to the shop' }));
});

test('dialog closes on Escape and the preview withdrawal page sends no request', async () => {
  mount();
  const u = user();
  await u.click(screen.getByRole('button', { name: 'Open bag, 0 items' }));
  assert.ok(screen.getByRole('dialog'));
  await u.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog'), null);
  await u.click(screen.getByRole('link', { name: 'Withdraw from contract' }));
  await waitFor(() =>
    assert.match(screen.getByRole('main').textContent, /does not conclude contracts/),
  );
});

test('original protein shop shows 14.99 per unit and recalculates two units with UK delivery', async () => {
  mount('/en/shop?range=protein');
  const u = user();
  await screen.findByRole('heading', { level: 1, name: 'Plant Protein' });
  const main = within(screen.getByRole('main'));
  assert.equal(main.getAllByText('€14.99').length, 3);
  assert.equal(main.getAllByText('per unit').length, 3);
  await u.click(main.getByRole('button', { name: /Add to bag:.*Chocolate/i }));
  const dialog = within(screen.getByRole('dialog'));
  await u.click(dialog.getByRole('button', { name: 'Increase quantity' }));
  await u.selectOptions(dialog.getByRole('combobox'), 'GB');
  assert.match(screen.getByRole('dialog').textContent, /Chocolate Plant Protein/);
  assert.match(screen.getByRole('dialog').textContent, /41.97/);
  assert.equal(
    JSON.parse(dom.window.localStorage.getItem('earthveda-cart-v3')).items['protein-chocolate'],
    2,
  );
});

test('existing related-product links reset quantity and both purchase controls use the correct total', async () => {
  mount('/en/product/plant-protein-mango');
  const u = user();
  await screen.findByRole('heading', { level: 1, name: /Mango/ });
  const main = within(screen.getByRole('main'));
  await u.click(main.getByRole('button', { name: 'Increase quantity' }));
  assert.equal(main.getAllByRole('button', { name: /Add to bag.*29.98/ }).length, 2);
  await u.click(main.getByRole('link', { name: 'Chocolate Plant Protein', exact: true }));
  await screen.findByRole('heading', { level: 1, name: /Chocolate/ });
  assert.equal(
    within(screen.getByRole('main'))
      .getByRole('group', { name: 'Quantity' })
      .querySelector('output').textContent,
    '1',
  );
  assert.equal(
    within(screen.getByRole('main')).getAllByRole('button', { name: /Add to bag.*14.99/ }).length,
    2,
  );
});

test('original German protein listing formats the price as 14,99 EUR per unit', async () => {
  mount('/shop?range=protein');
  await screen.findByRole('heading', { level: 1, name: 'Plant Protein' });
  const main = within(screen.getByRole('main'));
  const cards = main.getAllByRole('article');
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.match(card.textContent, /14,99/);
    assert.match(card.textContent, /pro Stück/);
  }
});

test('new-product admin range selection defaults protein to 14.99 without overwriting custom prices', async () => {
  const { MemoryRouter } = await import('react-router-dom');
  const ProductForm = (await import('../src/admin/pages/ProductForm.jsx')).default;
  render(React.createElement(MemoryRouter, null, React.createElement(ProductForm)));
  const u = user();
  const price = screen.getByLabelText('Price incl. VAT (€)');
  assert.equal(price.value, '2.99');
  await u.selectOptions(screen.getByLabelText('Range'), 'protein');
  assert.equal(price.value, '14.99');
  await u.clear(price);
  await u.type(price, '19,95');
  await u.selectOptions(screen.getByLabelText('Range'), 'foxnuts');
  assert.equal(price.value, '19,95');
});
