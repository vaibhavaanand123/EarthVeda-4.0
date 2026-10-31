/**
 * Localised URLs. German lives at the root (earthvedaessentials.de/...),
 * English under /en. Shared by the storefront router, the sitemap and emails.
 */
export const ROUTES = Object.freeze({
  home: { de: '/', en: '/en' },
  shop: { de: '/shop', en: '/en/shop' },
  product: { de: '/produkt/:slug', en: '/en/product/:slug' },
  box: { de: '/box-zusammenstellen', en: '/en/build-your-box' },
  story: { de: '/unsere-geschichte', en: '/en/our-story' },
  cart: { de: '/warenkorb', en: '/en/bag' },
  checkout: { de: '/kasse', en: '/en/checkout' },
  mockPay: { de: '/checkout/mock-pay', en: '/en/checkout/mock-pay' },
  orderSuccess: { de: '/bestellung/danke', en: '/en/order/thank-you' },
  track: { de: '/bestellung-verfolgen', en: '/en/track-order' },
  wishlist: { de: '/merkliste', en: '/en/wishlist' },
  faq: { de: '/faq', en: '/en/faq' },
  contact: { de: '/kontakt', en: '/en/contact' },
  imprint: { de: '/impressum', en: '/en/imprint' },
  terms: { de: '/agb', en: '/en/terms' },
  withdrawal: { de: '/widerrufsbelehrung', en: '/en/cancellation-policy' },
  withdraw: { de: '/vertrag-widerrufen', en: '/en/withdraw' },
  privacy: { de: '/datenschutz', en: '/en/privacy' },
  shipping: { de: '/versand-und-zahlung', en: '/en/shipping-and-payment' },
  accessibility: { de: '/barrierefreiheit', en: '/en/accessibility' },
  newsletterConfirm: { de: '/newsletter/bestaetigen', en: '/en/newsletter/confirm' },
  newsletterUnsubscribe: { de: '/newsletter/abmelden', en: '/en/newsletter/unsubscribe' },
});

export const LEGAL_SLUGS = Object.freeze([
  'imprint',
  'terms',
  'withdrawal',
  'privacy',
  'shipping',
  'accessibility',
]);

/** Build a localised path: path('product', 'en', { slug: 'peri-peri' }). */
export function path(key, lang, params = {}) {
  const pattern = ROUTES[key]?.[lang] ?? ROUTES[key]?.de ?? '/';
  return pattern.replace(/:(\w+)/g, (_, name) => encodeURIComponent(params[name] ?? ''));
}

/** Find the route key and params for a pathname, e.g. for the language toggle. */
export function matchRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const [key, langs] of Object.entries(ROUTES)) {
    for (const [lang, pattern] of Object.entries(langs)) {
      const names = [];
      const regex = new RegExp(
        `^${pattern.replace(/:(\w+)/g, (_, n) => {
          names.push(n);
          return '([^/]+)';
        })}$`,
      );
      const m = clean.match(regex);
      if (m) {
        try {
          return {
            key,
            lang,
            params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])),
          };
        } catch {
          return null; // malformed percent-encoding
        }
      }
    }
  }
  return null;
}

export const langFromPath = (pathname) => (/^\/en(\/|$)/.test(pathname) ? 'en' : 'de');
