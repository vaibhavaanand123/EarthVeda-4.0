import { COUNTRIES, DEFAULT_COUNTRY } from '../../shared/markets.js';
import { availableQuantity, localiseProduct } from '../../shared/catalog.js';
import { ORDER_LIMITS, boxKey, quoteBasket } from '../../shared/pricing.js';

/** Pure cart logic: no React, unit-testable in Node. */

export const EMPTY_CART = Object.freeze({ items: {}, boxes: [], country: DEFAULT_COUNTRY });

const isPick = (p) =>
  p &&
  typeof p.productId === 'string' &&
  Number.isInteger(p.quantity) &&
  p.quantity > 0 &&
  p.quantity <= ORDER_LIMITS.maxPicksPerBox;
export const isCartState = (v) =>
  v &&
  typeof v === 'object' &&
  v.items &&
  typeof v.items === 'object' &&
  !Array.isArray(v.items) &&
  Object.keys(v.items).length <= ORDER_LIMITS.maxLines &&
  Object.values(v.items).every(
    (q) => Number.isInteger(q) && q > 0 && q <= ORDER_LIMITS.maxQuantityPerLine,
  ) &&
  Array.isArray(v.boxes) &&
  v.boxes.length <= ORDER_LIMITS.maxLines &&
  v.boxes.every(
    (b) =>
      b &&
      typeof b === 'object' &&
      typeof b.key === 'string' &&
      typeof b.bundleId === 'string' &&
      Number.isInteger(b.quantity) &&
      b.quantity > 0 &&
      b.quantity <= ORDER_LIMITS.maxBoxQuantity &&
      Array.isArray(b.picks) &&
      b.picks.length > 0 &&
      b.picks.length <= ORDER_LIMITS.maxPicksPerBox &&
      b.picks.every(isPick),
  ) &&
  Object.hasOwn(COUNTRIES, v.country);

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      if (typeof action.id !== 'string' || !Number.isInteger(action.amount) || action.amount <= 0)
        return state;
      const next = Math.min(
        ORDER_LIMITS.maxQuantityPerLine,
        (Object.hasOwn(state.items, action.id) ? state.items[action.id] : 0) + action.amount,
      );
      return { ...state, items: { ...state.items, [action.id]: next } };
    }
    case 'set': {
      const items = { ...state.items };
      if (!Number.isInteger(action.quantity) || action.quantity <= 0) delete items[action.id];
      else items[action.id] = Math.min(ORDER_LIMITS.maxQuantityPerLine, action.quantity);
      return { ...state, items };
    }
    case 'addBox': {
      const key = boxKey(action.bundleId, action.picks);
      const existing = state.boxes.find((b) => b.key === key);
      if (existing)
        return {
          ...state,
          boxes: state.boxes.map((b) =>
            b.key === key
              ? { ...b, quantity: Math.min(ORDER_LIMITS.maxBoxQuantity, b.quantity + 1) }
              : b,
          ),
        };
      return {
        ...state,
        boxes: [
          ...state.boxes,
          { key, bundleId: action.bundleId, quantity: 1, picks: action.picks },
        ],
      };
    }
    case 'setBox': {
      if (!Number.isInteger(action.quantity) || action.quantity <= 0)
        return { ...state, boxes: state.boxes.filter((b) => b.key !== action.key) };
      return {
        ...state,
        boxes: state.boxes.map((b) =>
          b.key === action.key
            ? { ...b, quantity: Math.min(ORDER_LIMITS.maxBoxQuantity, action.quantity) }
            : b,
        ),
      };
    }
    case 'country':
      return Object.hasOwn(COUNTRIES, action.country)
        ? { ...state, country: action.country }
        : state;
    case 'clear':
      return { ...EMPTY_CART, country: state.country };
    case 'replace':
      return isCartState(action.state) ? action.state : state;
    default:
      return state;
  }
}

function productIssue(product) {
  if (!product || !product.active) return 'gone';
  if (!product.inStock) return 'soldOut';
  return null;
}

/**
 * Display summary. Lines with problems are shown but excluded from totals;
 * the server recomputes everything at checkout with the same shared engine.
 */
export function summariseCart(state, { resolveProduct, resolveBundle, shippingRates, lang }) {
  const marketProduct = (id) => {
    const p = resolveProduct(id);
    const market = p?.stockByMarket
      ? { ...p, inStock: p.inStock && (p.stockByMarket[state.country] || 0) > 0 }
      : p;
    return localiseProduct(market, lang);
  };
  const productLines = Object.entries(state.items).map(([id, quantity]) => {
    const product = marketProduct(id);
    return { kind: 'product', key: id, id, quantity, product, issue: productIssue(product) };
  });
  const boxLines = state.boxes.map((box) => {
    const bundle = resolveBundle(box.bundleId);
    const picks = box.picks.map((p) => ({ ...p, product: marketProduct(p.productId) }));
    const packs = picks.reduce((n, p) => n + p.quantity, 0);
    const broken =
      !bundle ||
      !bundle.active ||
      packs !== bundle.size ||
      picks.some((p) => productIssue(p.product) || !p.product.bundleEligible);
    return { kind: 'box', ...box, bundle, picks, issue: broken ? 'box' : null };
  });
  const valid = {
    items: productLines
      .filter((l) => !l.issue)
      .map((l) => ({ productId: l.id, quantity: l.quantity })),
    boxes: boxLines
      .filter((l) => !l.issue)
      .map(({ bundleId, quantity, picks }) => ({
        bundleId,
        quantity,
        picks: picks.map(({ productId, quantity: q }) => ({ productId, quantity: q })),
      })),
  };
  let quote = null;
  if ((valid.items.length || valid.boxes.length) && shippingRates?.[state.country]) {
    try {
      quote = quoteBasket(valid, {
        country: state.country,
        lang,
        resolveProduct: marketProduct,
        resolveBundle,
        shippingRates,
      });
    } catch {
      quote = null;
    }
  }
  const lineTotal = (line) => {
    if (line.issue) return 0;
    if (line.kind === 'product') return (line.product?.price ?? 0) * line.quantity;
    return (line.bundle?.price ?? 0) * line.quantity;
  };
  // Keep missing products visible so shoppers can remove a stale saved line.
  const lines = [...boxLines, ...productLines].map((l) => ({
    ...l,
    lineTotal: lineTotal(l),
  }));
  const required = new Map();
  for (const line of lines.filter((l) => !l.issue)) {
    const picks = line.kind === 'box' ? line.picks : [{ productId: line.id, quantity: 1 }];
    for (const pick of picks)
      required.set(
        pick.productId,
        (required.get(pick.productId) || 0) + pick.quantity * line.quantity,
      );
  }
  for (const line of lines.filter((l) => !l.issue)) {
    const picks = line.kind === 'box' ? line.picks : [{ productId: line.id }];
    if (
      picks.some(
        (pick) =>
          (required.get(pick.productId) || 0) >
          availableQuantity(resolveProduct(pick.productId), state.country),
      )
    )
      line.issue = 'stockLimit';
  }
  const hasIssues = lines.some((l) => l.issue);
  const count = lines.reduce(
    (n, l) => n + (l.kind === 'box' ? (l.bundle?.size ?? 0) * l.quantity : l.quantity),
    0,
  );
  return {
    lines,
    count,
    country: state.country,
    subtotal: quote?.subtotal ?? 0,
    shipping: quote?.shipping ?? 0,
    total: quote?.total ?? 0,
    vat: quote?.vat ?? [],
    hasIssues,
    canCheckout: Boolean(quote) && !hasIssues,
    payload: valid,
  };
}
