/**
 * Analytics seam. Events are queued on `window.dataLayer` only after the
 * shopper has consented to analytics in the cookie banner. No tracker is
 * loaded here; add one in ConsentContext once consent is given.
 */
let consented = false;

export const analyticsService = {
  setConsent(value) {
    consented = Boolean(value);
  },
  track(event, payload = {}) {
    if (!consented || typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...payload });
  },
};
