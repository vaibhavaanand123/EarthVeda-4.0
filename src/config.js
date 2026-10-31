const env = import.meta.env;

export const config = Object.freeze({
  /** Standalone storefront preview is the safe default on Vercel. */
  preview: env.VITE_COMMERCE_MODE !== 'connected',
  /** Same-origin API served by the bundled Node server. */
  apiBaseUrl: (env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/$/, ''),
  publicSiteUrl: (env.VITE_PUBLIC_SITE_URL?.trim() || '').replace(/\/$/, ''),
  appName: 'EarthVeda Essentials',
  /** Optional customer-service WhatsApp number for the chat button, e.g. +4915112345678. */
  whatsappNumber: (env.VITE_WHATSAPP_NUMBER || '').replace(/[^\d]/g, ''),
});
