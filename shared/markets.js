/**
 * Countries we ship to. Every price is in EUR for every country; only shipping,
 * VAT and address rules differ. Add a country here (and a shipping rate in the
 * admin settings) to open a new market.
 */

export const CURRENCY = 'EUR';
export const LANGS = Object.freeze(['de', 'en']);
export const DEFAULT_LANG = 'de';
export const DEFAULT_COUNTRY = 'DE';

export const COUNTRIES = Object.freeze({
  DE: Object.freeze({
    code: 'DE',
    name: { de: 'Deutschland', en: 'Germany' },
    dialCode: '49',
    postal: {
      pattern: '^[0-9]{5}$',
      example: '10115',
      hint: { de: 'Bitte gib eine 5-stellige PLZ ein.', en: 'Enter a 5-digit postcode.' },
    },
  }),
  GB: Object.freeze({
    code: 'GB',
    name: { de: 'Vereinigtes Königreich', en: 'United Kingdom' },
    dialCode: '44',
    postal: {
      // Royal Mail format, e.g. SW1A 1AA, EC1V 9HX, M1 1AE.
      pattern: '^(GIR ?0AA|[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})$',
      example: 'SW1A 1AA',
      hint: {
        de: 'Bitte gib eine gültige britische Postleitzahl ein, z. B. SW1A 1AA.',
        en: 'Enter a valid UK postcode, e.g. SW1A 1AA.',
      },
    },
  }),
});

export const isCountry = (value) => typeof value === 'string' && Object.hasOwn(COUNTRIES, value);
export const isLang = (value) => LANGS.includes(value);

/** Uppercase and canonical spacing so "sw1a1aa" is stored as "SW1A 1AA". */
export function normalisePostcode(value, country) {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (country !== 'GB') return raw;
  const compact = raw.replace(/\s/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

export function isValidPostcode(value, country) {
  const settings = COUNTRIES[country];
  if (!settings) return false;
  return new RegExp(settings.postal.pattern).test(normalisePostcode(value, country));
}

/**
 * Normalise a phone number to E.164 (+4915112345678). Numbers starting with a
 * national 0 get the delivery country's dialling code. Returns '' when invalid.
 */
export function toE164(value, country) {
  // "+44 (0)20 7946 0958": the national trunk 0 must go when a country code is present.
  let digits = String(value ?? '')
    .replace(/^(\s*(?:\+|00)\d{1,3})\s*\(0\)/, '$1')
    .replace(/[\s().\-/]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith('0') && COUNTRIES[country])
    digits = `+${COUNTRIES[country].dialCode}${digits.slice(1)}`;
  else if (!digits.startsWith('+') && COUNTRIES[country])
    digits = `+${COUNTRIES[country].dialCode}${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(digits) ? digits : '';
}

const LOCALES = { de: 'de-DE', en: 'en-IE' };

/** "2,99 €" in German, "€2.99" in English. Money is always integer cents. */
export function formatMoney(cents, lang = DEFAULT_LANG) {
  if (!Number.isSafeInteger(cents)) return '';
  return new Intl.NumberFormat(LOCALES[lang] || LOCALES.de, {
    style: 'currency',
    currency: CURRENCY,
  }).format(cents / 100);
}

export function formatDateTime(iso, lang = DEFAULT_LANG, timeZone = 'Europe/Berlin') {
  if (!iso) return '';
  return new Intl.DateTimeFormat(LOCALES[lang] || LOCALES.de, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}
