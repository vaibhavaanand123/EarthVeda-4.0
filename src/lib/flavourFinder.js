/**
 * Flavour finder: turns three answers into a box where every chosen flavour
 * goes in twice. Pure functions, unit-tested in Node.
 *
 * Profiles for the current range. New flavours added in the admin without a
 * profile still work: they get a neutral default and are ranked by sort order.
 */
export const PROFILES = Object.freeze({
  'cream-onion': { spice: 0, taste: 'classic' },
  'peri-peri': { spice: 2, taste: 'savoury' },
  'asian-pepper-garlic': { spice: 1, taste: 'savoury' },
  'pink-salt-pepper': { spice: 1, taste: 'classic' },
  'cheese-herbs': { spice: 0, taste: 'cheese' },
  'four-cheese': { spice: 0, taste: 'cheese' },
  'butter-chicken': { spice: 1, taste: 'savoury' },
});

export const PACK_STEP = 2;

const profileOf = (id) => PROFILES[id] ?? { spice: 1, taste: 'classic' };

/** Rank flavours for the answers; `seed` makes "surprise me" stable per click. */
export function rankFlavours(products, { spice = 1, taste = 'surprise' }, seed = 0) {
  const jitter = (id) => {
    let h = seed;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return (h % 1000) / 1000;
  };
  return [...products]
    .map((p, i) => {
      const prof = profileOf(p.id);
      const score =
        3 -
        Math.abs(prof.spice - spice) * 1.5 +
        (taste !== 'surprise' && prof.taste === taste ? 3 : 0) +
        (taste === 'surprise' ? jitter(p.id) * 4 : 0) -
        i * 0.01; // stable tie-break by catalogue order
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((r) => r.product);
}

/** Fill a box of `size` with pairs of the ranked flavours (cycling if needed). */
export function suggestBox(ranked, size) {
  const picks = {};
  if (!ranked.length) return picks;
  const slots = Math.floor(size / PACK_STEP);
  for (let i = 0; i < slots; i += 1) {
    const id = ranked[i % ranked.length].id;
    picks[id] = (picks[id] || 0) + PACK_STEP;
  }
  return picks;
}

export const filled = (picks) => Object.values(picks).reduce((a, b) => a + b, 0);

export function addPair(picks, id, size) {
  if (filled(picks) + PACK_STEP > size) return picks;
  return { ...picks, [id]: (picks[id] || 0) + PACK_STEP };
}

export function removePair(picks, id) {
  const next = { ...picks };
  const left = (next[id] || 0) - PACK_STEP;
  if (left > 0) next[id] = left;
  else delete next[id];
  return next;
}

/** Shrink to fit a smaller box by dropping pairs from the most-picked flavours. */
export function fitToSize(picks, size) {
  let next = { ...picks };
  while (filled(next) > size) {
    const [id] = Object.entries(next).sort((a, b) => b[1] - a[1])[0];
    next = removePair(next, id);
  }
  return next;
}

export const toPicks = (picks) =>
  Object.entries(picks).map(([productId, quantity]) => ({ productId, quantity }));
