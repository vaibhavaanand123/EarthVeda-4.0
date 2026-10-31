/** Initial gross prices in EUR cents. Live prices remain managed in the database. */
export const CATALOG_PRICES = Object.freeze({ foxnuts: 299, protein: 1499 });

/** Product ranges. Products themselves live in the database (managed in the admin). */
export const RANGES = Object.freeze({
  foxnuts: {
    id: 'foxnuts',
    label: { de: 'Geröstete Fuchsnüsse', en: 'Roasted Foxnuts' },
    short: { de: 'Fuchsnüsse', en: 'Foxnuts' },
  },
  protein: {
    id: 'protein',
    label: { de: 'Plant Protein', en: 'Plant Protein' },
    short: { de: 'Protein', en: 'Protein' },
  },
});

/** Flatten a product's translations for one language. */
export function localiseProduct(product, lang) {
  if (!product) return null;
  const t = product.i18n?.[lang] || product.i18n?.en || {};
  return {
    ...product,
    name: t.name || product.id,
    fullName: t.fullName || t.name || product.id,
    description: t.description || '',
    ingredients: t.ingredients || '',
    allergens: t.allergens || '',
    storage: t.storage || '',
    howToEnjoy: t.howToEnjoy || '',
    highlights: t.highlights || [],
    rangeLabel: RANGES[product.range]?.label[lang] || product.range,
  };
}

/** Short flavour name, e.g. "Mango" for "Mango Plant Protein". */
export const flavourName = (product, lang) =>
  (product?.i18n?.[lang]?.name || '').replace(/^Plant Protein /, '').replace(/ Plant Protein$/, '');

/** The selected delivery market must govern every purchase control, not just the bag. */
export function availableQuantity(product, country) {
  if (!product?.active || !product.inStock) return 0;
  if (!product.stockByMarket) return Infinity;
  return Math.max(0, Math.floor(product.stockByMarket[country] || 0));
}
