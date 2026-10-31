import { isCountry, isValidPostcode } from '../../shared/markets.js';

export const PREVIEW_METHODS = Object.freeze([
  'Mastercard',
  'Visa',
  'American Express',
  'PayPal',
  'Klarna',
  'Apple Pay',
  'Google Pay',
  'Maestro',
]);

export function validPreviewAddress(form, country) {
  if (!isCountry(country) || !form || typeof form !== 'object') return false;
  const fields = ['email', 'firstName', 'lastName', 'street', 'postalCode', 'city'];
  if (
    fields.some(
      (key) => typeof form[key] !== 'string' || !form[key].trim() || form[key].length > 200,
    )
  )
    return false;
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    isValidPostcode(form.postalCode, country)
  );
}

export function exampleAddress(country) {
  return {
    email: 'hello@example.com',
    firstName: 'Alex',
    lastName: 'Example',
    street: country === 'GB' ? '10 Example Street' : 'Beispielstraße 10',
    postalCode: country === 'GB' ? 'SW1A 1AA' : '10115',
    city: country === 'GB' ? 'London' : 'Berlin',
  };
}

export function validNewsletter(email, consent) {
  return (
    consent === true &&
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}
