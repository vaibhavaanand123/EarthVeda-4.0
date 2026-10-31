import { SEED_PRODUCTS, SEED_SETTINGS } from '../../shared/seed.js';
import { siteContent } from './site.js';

/** Explicit presentation data. No stock or food-label facts are invented. */
export const PREVIEW_STORE = {
  products: SEED_PRODUCTS.map((p) => ({
    ...p,
    active: true,
    inStock: true,
    // Availability here enables a local demo basket, not a promise of physical stock.
    image: p.range === 'protein' ? `/images/${p.id}-clean.webp` : p.image,
    i18n: Object.fromEntries(
      Object.entries(p.i18n).map(([lang, text]) => [lang, { ...text, highlights: [] }]),
    ),
  })),
  shipping: SEED_SETTINGS.shipping,
  bundles: SEED_SETTINGS.bundles,
  business: siteContent.business,
  story: siteContent.story,
  newsletter: { incentive: null, welcomeCode: '' },
};
