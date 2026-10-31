import crypto from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(crypto.scrypt);

/** URL-safe random token (default 256 bits). */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Keyed hash for values we must match later but never need to read (IPs, tokens). */
export const hmac = (secret, value) =>
  crypto.createHmac('sha256', secret).update(String(value)).digest('hex');

/** Constant-time string comparison that also hides length differences. */
export function safeEqual(a, b) {
  const x = crypto
    .createHash('sha256')
    .update(String(a ?? ''))
    .digest();
  const y = crypto
    .createHash('sha256')
    .update(String(b ?? ''))
    .digest();
  return crypto.timingSafeEqual(x, y) && String(a ?? '').length === String(b ?? '').length;
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** scrypt password hash: "scrypt$N$r$p$salt$hash". */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    // Burn comparable time so unknown users are not distinguishable by timing.
    await scrypt('x', 'salt-for-timing', SCRYPT.keylen, SCRYPT);
    return false;
  }
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(
    String(password).normalize('NFKC'),
    Buffer.from(salt, 'base64url'),
    expected.length,
    {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    },
  );
  return crypto.timingSafeEqual(expected, actual);
}

const ORDER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L

export function randomOrderNumber() {
  // Rejection sampling keeps every character equally likely.
  let out = 'EV-';
  while (out.length < 11) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 248) out += ORDER_ALPHABET[byte % ORDER_ALPHABET.length];
  }
  return out;
}

/** Minimal cookie parsing (we only read our own cookies). */
export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}
