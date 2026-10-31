import crypto from 'node:crypto';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { SETTINGS_SCHEMAS } from './schemas.js';
export function createCatalogService({
  productRepository,
  settingsRepository,
  audit,
  inventory,
  config,
  now,
}) {
  let cache = null,
    loadedAt = 0,
    loading = null;
  const snapshot = () => {
    if (!cache) throw new Error('Catalogue not initialized');
    return cache;
  };
  const invalidate = () => {
    loadedAt = 0;
  };
  const validatePublication = (p) => {
    if (p.bundleEligible && p.range !== 'foxnuts')
      throw badRequest(
        'invalid_bundle_product',
        'Only foxnuts can be included in the current boxes.',
      );
    if (!config.isProduction || !p.active) return;
    const complete =
      p.netWeightGrams > 0 &&
      p.nutrition &&
      p.image &&
      ['de', 'en'].every((l) => p.i18n[l].ingredients && p.i18n[l].storage);
    if (!complete)
      throw badRequest(
        'catalogue_incomplete',
        'Published food products require verified weight, ingredients, storage, nutrition and an image. Save as a draft first.',
      );
  };
  const service = {
    async refresh(force = false) {
      if (!force && cache && Date.now() - loadedAt < 3000) return;
      // Forced checkout reads await an in-flight refresh and then take a new snapshot.
      if (loading) {
        await loading;
        if (!force) return;
      }
      loading = (async () => {
        const products = await productRepository.listLive();
        const settings = await settingsRepository.all();
        const stocks = await inventory.list();
        cache = {
          products: products.map((p) => ({
            ...p,
            stockByMarket: Object.fromEntries(
              stocks.filter((s) => s.productId === p.id).map((s) => [s.country, s.available]),
            ),
          })),
          settings,
        };
        loadedAt = Date.now();
      })();
      try {
        await loading;
      } finally {
        loading = null;
      }
    },
    invalidate,
    settings: () => snapshot().settings,
    shippingRates: () => snapshot().settings.shipping,
    resolveBundle: (id) => (snapshot().settings.bundles || []).find((b) => b.id === id) || null,
    resolveProduct: (id) => snapshot().products.find((p) => p.id === id) || null,
    findBySlug: (slug) => snapshot().products.find((p) => p.slug === slug) || null,
    liveSlugs: () =>
      snapshot()
        .products.filter((p) => p.active)
        .map((p) => p.slug),
    storefront() {
      const s = snapshot();
      const products = s.products
        .filter((p) => p.active)
        .map(({ version: _v, archivedAt: _a, createdAt: _c, updatedAt: _u, ...p }) => ({
          ...p,
          inStock: p.inStock && Object.values(p.stockByMarket).some((n) => n > 0),
        }));
      const { isPlaceholder: _placeholder, ...story } = s.settings.story || {};
      return JSON.stringify({
        products,
        shipping: s.settings.shipping,
        bundles: (s.settings.bundles || []).filter((b) => b.active),
        story,
        business: s.settings.business,
        newsletter: {
          incentive: s.settings.newsletter?.welcomeCode ? s.settings.newsletter.incentive : null,
        },
      });
    },
    adminList: () => productRepository.listAll(),
    async getProduct(id) {
      const p = await productRepository.findById(id);
      if (!p) throw notFound('Product not found.');
      return p;
    },
    generateSku: (range) => productRepository.generateSku(range),
    async createProduct(input, actor) {
      if (await productRepository.findBySlug(input.slug))
        throw conflict('slug_taken', 'A product with this URL already exists.');
      if (!input.sku) input = { ...input, sku: await productRepository.generateSku(input.range) };
      if (await productRepository.findBySku(input.sku))
        throw conflict('sku_taken', 'SKU already exists.');
      validatePublication(input);
      const p = await productRepository.insert({ ...input, id: crypto.randomUUID() }, now());
      await audit(actor, 'product.create', 'product', p.id, { sku: p.sku });
      invalidate();
      return p;
    },
    async updateProduct(id, { version, ...input }, actor) {
      const current = await service.getProduct(id);
      for (const [key, method] of [
        ['slug', 'findBySlug'],
        ['sku', 'findBySku'],
      ]) {
        const owner = await productRepository[method](input[key]);
        if (owner && owner.id !== id) throw conflict(`${key}_taken`, `${key} already exists.`);
      }
      validatePublication(input);
      if (!(await productRepository.update({ ...current, ...input, id }, version, now())))
        throw conflict('stale', 'Product changed. Reload before saving.');
      await audit(actor, 'product.update', 'product', id, {
        sku: input.sku,
        price: input.price,
        active: input.active,
      });
      invalidate();
      return service.getProduct(id);
    },
    async setFlags(id, { version, ...flags }, actor) {
      const p = await service.getProduct(id);
      validatePublication({ ...p, ...flags });
      if (!(await productRepository.update({ ...p, ...flags }, version, now())))
        throw conflict('stale', 'Product changed. Reload before saving.');
      await audit(actor, 'product.flags', 'product', id, flags);
      invalidate();
      return service.getProduct(id);
    },
    async archiveProduct(id, actor) {
      await service.getProduct(id);
      await productRepository.archive(id, now());
      await audit(actor, 'product.archive', 'product', id);
      invalidate();
      return service.getProduct(id);
    },
    async restoreProduct(id, actor) {
      await service.getProduct(id);
      await productRepository.restore(id, now());
      await audit(actor, 'product.restore', 'product', id);
      invalidate();
      return service.getProduct(id);
    },
    async updateSetting(key, value, actor) {
      const parsed = SETTINGS_SCHEMAS[key].parse(value);
      await settingsRepository.set(key, parsed, actor?.email || String(actor), now());
      await audit(actor, 'settings.update', 'settings', key);
      invalidate();
      return parsed;
    },
  };
  return service;
}
