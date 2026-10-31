/** Values for placeholders in FAQ answers (live shipping prices and times). */
export function faqVars(store, money, lang) {
  const { DE, GB } = store.shipping || {};
  return {
    de: DE ? money(DE.fee) : '',
    gb: GB ? money(GB.fee) : '',
    etaDE: DE?.eta?.[lang] ?? '',
    etaGB: GB?.eta?.[lang] ?? '',
  };
}
