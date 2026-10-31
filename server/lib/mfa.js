import crypto from 'node:crypto';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function encode(buffer) {
  let bits = 0,
    value = 0,
    result = '';
  for (const b of buffer) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function decode(secret) {
  let bits = 0,
    value = 0;
  const out = [];
  for (const c of secret) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export const generateSecret = () => encode(crypto.randomBytes(20));
export function totp(secret, counter) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', decode(secret)).update(b).digest();
  const off = h[19] & 15;
  return String((h.readUInt32BE(off) & 0x7fffffff) % 1000000).padStart(6, '0');
}
export function verifyTotp(secret, code, time = Date.now()) {
  if (!/^\d{6}$/.test(code || '')) return null;
  const counter = Math.floor(time / 30000);
  for (const c of [counter - 1, counter, counter + 1])
    if (crypto.timingSafeEqual(Buffer.from(totp(secret, c)), Buffer.from(code))) return c;
  return null;
}
const key = (secret) => crypto.createHash('sha256').update(secret).digest();
export function encryptSecret(value, appSecret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(appSecret), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}
export function decryptSecret(value, appSecret) {
  const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64url'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(appSecret), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
