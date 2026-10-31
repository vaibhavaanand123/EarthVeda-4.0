import { COUNTRIES } from './markets.js';

/**
 * Basket pricing. Pure and deterministic: the browser uses it to preview the
 * basket and the server uses the very same function to charge. Only the
 * server's result is ever binding.
 *
 * All prices are gross (VAT included) integer cents in EUR.
 */

export const ORDER_LIMITS = Object.freeze({
  maxQuantityPerLine: 20,
  maxBoxQuantity: 10,
  maxLines: 25,
  maxPicksPerBox: 16,
});

export class QuoteError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QuoteError';
    this.code = code;
    this.details = details;
  }
}

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

/** Stable identity for a box: same size + same flavour mix = same cart line. */
export function boxKey(bundleId, picks) {
  const canonical = [...mergePicks(picks)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, q]) => `${id}:${q}`)
    .join(',');
  return `${bundleId}|${canonical}`;
}

function mergePicks(picks) {
  const merged = new Map();
  for (const pick of picks || []) {
    if (typeof pick?.productId !== 'string' || !isPositiveInt(pick?.quantity))
      throw new QuoteError('invalid_box', 'A box contains an invalid flavour.');
    merged.set(pick.productId, (merged.get(pick.productId) || 0) + pick.quantity);
  }
  return merged;
}

const productName = (product, lang) =>
  product?.i18n?.[lang]?.fullName ||
  product?.i18n?.[lang]?.name ||
  product?.i18n?.en?.name ||
  product?.id;

const vatRateOf = (product, country) => {
  const rate = product?.vat?.[country];
  return Number.isFinite(rate) && rate >= 0 && rate <= 30 ? rate : 0;
};

/** Split `total` cents over `weights` so the parts add up exactly (largest remainder). */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let rest = total - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest -= 1) parts[order[k][1]] += 1;
  return parts;
}

export function shippingFor(subtotal, country, rates) {
  const rate = rates?.[country];
  if (!rate || subtotal <= 0) return 0;
  if (Number.isSafeInteger(rate.freeFrom) && rate.freeFrom > 0 && subtotal >= rate.freeFrom)
    return 0;
  return rate.fee;
}

/**
 * @param {{ items?: Array<{productId:string, quantity:number}>,
 *           boxes?: Array<{bundleId:string, quantity:number, picks:Array<{productId:string, quantity:number}>}> }} basket
 * @param {{ country: string, lang?: string,
 *           resolveProduct: (id:string) => object|null,
 *           resolveBundle: (id:string) => object|null,
 *           shippingRates: Record<string, {fee:number, freeFrom?:number|null}> }} ctx
 */
export function quoteBasket(basket, ctx) {
  const { country, lang = 'en', resolveProduct, resolveBundle, shippingRates } = ctx;
  if (!COUNTRIES[country] || !shippingRates?.[country])
    throw new QuoteError('invalid_country', 'We do not ship to this country yet.');
  const items = basket?.items ?? [];
  const boxes = basket?.boxes ?? [];
  if (!Array.isArray(items) || !Array.isArray(boxes))
    throw new QuoteError('invalid_basket', 'Your basket is invalid.');
  if (items.length + boxes.length === 0) throw new QuoteError('empty_cart', 'Your bag is empty.');
  if (items.length + boxes.length > ORDER_LIMITS.maxLines)
    throw new QuoteError('too_many_lines', 'Too many different products in one order.');

  const lines = [];
  /** VAT buckets: rate -> gross cents. */
  const buckets = new Map();
  const addToBucket = (rate, cents) => buckets.set(rate, (buckets.get(rate) || 0) + cents);

  const sellable = (product, productId) => {
    if (!product || !product.active)
      throw new QuoteError('unavailable', 'A product in your bag is no longer available.', {
        productId,
      });
    if (!product.inStock)
      throw new QuoteError('out_of_stock', `${productName(product, lang)} is sold out.`, {
        productId,
      });
    if (!Number.isSafeInteger(product.price) || product.price < 0)
      throw new QuoteError('unavailable', 'A product in your bag has no price.', { productId });
  };

  // Single products.
  const merged = new Map();
  for (const item of items) {
    if (typeof item?.productId !== 'string' || !isPositiveInt(item?.quantity))
      throw new QuoteError('invalid_item', 'A bag item is invalid.');
    merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);
  }
  for (const [productId, quantity] of merged) {
    const product = resolveProduct(productId);
    sellable(product, productId);
    if (quantity > ORDER_LIMITS.maxQuantityPerLine)
      throw new QuoteError(
        'quantity_limit',
        `You can order up to ${ORDER_LIMITS.maxQuantityPerLine} of each product.`,
        { productId },
      );
    const vatRate = vatRateOf(product, country);
    const lineTotal = product.price * quantity;
    addToBucket(vatRate, lineTotal);
    lines.push({
      kind: 'product',
      productId,
      sku: product.sku,
      name: productName(product, lang),
      image: product.image,
      unitPrice: product.price,
      quantity,
      lineTotal,
      vatRate,
    });
  }

  // Flavour boxes (fixed price, fixed number of packs).
  const mergedBoxes = new Map();
  for (const box of boxes) {
    if (typeof box?.bundleId !== 'string' || !isPositiveInt(box?.quantity))
      throw new QuoteError('invalid_box', 'A box in your bag is invalid.');
    const picks = mergePicks(box.picks);
    if (picks.size === 0 || picks.size > ORDER_LIMITS.maxPicksPerBox)
      throw new QuoteError('invalid_box', 'A box in your bag is invalid.');
    const key = boxKey(box.bundleId, box.picks);
    const existing = mergedBoxes.get(key);
    if (existing) existing.quantity += box.quantity;
    else mergedBoxes.set(key, { bundleId: box.bundleId, quantity: box.quantity, picks });
  }
  for (const [key, box] of mergedBoxes) {
    const bundle = resolveBundle(box.bundleId);
    if (!bundle || !bundle.active)
      throw new QuoteError('unavailable', 'This box size is no longer available.', {
        bundleId: box.bundleId,
      });
    if (box.quantity > ORDER_LIMITS.maxBoxQuantity)
      throw new QuoteError(
        'quantity_limit',
        `You can order up to ${ORDER_LIMITS.maxBoxQuantity} of each box.`,
        { bundleId: box.bundleId },
      );
    const total = [...box.picks.values()].reduce((a, b) => a + b, 0);
    if (total !== bundle.size)
      throw new QuoteError('box_incomplete', `A box needs exactly ${bundle.size} packs.`, {
        bundleId: box.bundleId,
      });
    const picks = [];
    for (const [productId, quantity] of box.picks) {
      const product = resolveProduct(productId);
      sellable(product, productId);
      if (!product.bundleEligible)
        throw new QuoteError('not_in_box', `${productName(product, lang)} cannot go in a box.`, {
          productId,
        });
      picks.push({
        productId,
        sku: product.sku,
        name: product.i18n?.[lang]?.name || productName(product, lang),
        quantity,
        product,
      });
    }
    // Distribute the box price over its packs to book VAT per rate correctly.
    const lineTotal = bundle.price * box.quantity;
    const shares = allocate(
      lineTotal,
      picks.map((p) => p.product.price * p.quantity),
    );
    picks.forEach((p, i) => addToBucket(vatRateOf(p.product, country), shares[i]));
    const rates = [...new Set(picks.map((p) => vatRateOf(p.product, country)))];
    lines.push({
      kind: 'box',
      key,
      bundleId: bundle.id,
      sku: bundle.sku,
      name: bundle.name?.[lang] || bundle.name?.en || bundle.id,
      unitPrice: bundle.price,
      quantity: box.quantity,
      lineTotal,
      vatRate: rates.length === 1 ? rates[0] : null,
      size: bundle.size,
      picks: picks.map(({ productId, sku, name, quantity }) => ({
        productId,
        sku,
        name,
        quantity,
      })),
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = shippingFor(subtotal, country, shippingRates);

  // Shipping follows the goods: split it over the VAT rates by goods value.
  const rates = [...buckets.keys()].sort((a, b) => a - b);
  const shippingShares = allocate(
    shipping,
    rates.map((r) => buckets.get(r)),
  );
  const vat = rates
    .map((rate, i) => {
      const gross = buckets.get(rate) + shippingShares[i];
      return { rate, gross, amount: Math.round((gross * rate) / (100 + rate)) };
    })
    .filter((v) => v.gross > 0);

  const rate = shippingRates[country];
  return {
    country,
    currency: 'EUR',
    lines,
    itemCount: lines.reduce((n, l) => n + (l.kind === 'box' ? l.size * l.quantity : l.quantity), 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
    vat,
    vatTotal: vat.reduce((n, v) => n + v.amount, 0),
    freeShippingFrom: rate.freeFrom ?? null,
    amountToFreeShipping:
      Number.isSafeInteger(rate.freeFrom) && rate.freeFrom > 0
        ? Math.max(0, rate.freeFrom - subtotal)
        : null,
  };
}

/** Price per kg in cents (Grundpreis, required on German listings by PAngV). */
export function unitPricePerKg(price, netWeightGrams) {
  if (!Number.isSafeInteger(price) || !Number.isFinite(netWeightGrams) || netWeightGrams <= 0)
    return null;
  return Math.round((price * 1000) / netWeightGrams);
}
