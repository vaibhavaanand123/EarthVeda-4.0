import assert from 'node:assert/strict';
import { test } from 'node:test';
import Stripe from 'stripe';
import { loadConfig } from '../server/config.js';
import { encryptSecret, decryptSecret, verifyTotp, totp } from '../server/lib/mfa.js';
import { hashPassword, verifyPassword, randomOrderNumber } from '../server/lib/security.js';
import { stockRequirements } from '../server/db/inventoryRepository.js';
import { createStripeProvider } from '../server/payments/stripeProvider.js';
import { silentLogger } from '../server/lib/logger.js';

test('password hashes are salted and verify asynchronously', async () => {
  const a = await hashPassword('CorrectHorse42!'),
    b = await hashPassword('CorrectHorse42!');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('CorrectHorse42!', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
  assert.equal(await verifyPassword('anything', undefined), false);
});
test('TOTP follows the RFC test vector and rejects expired codes', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totp(secret, 1), '287082');
  assert.equal(verifyTotp(secret, '287082', 59000), 1);
  assert.equal(verifyTotp(secret, '287082', 300000), null);
});
test('encrypted MFA secrets fail authentication after tampering', () => {
  const secret = 'private setup key',
    key = 'a'.repeat(40),
    encrypted = encryptSecret(secret, key);
  assert.equal(decryptSecret(encrypted, key), secret);
  assert.throws(() => decryptSecret(encrypted, 'b'.repeat(40)));
});
test('stock requirements aggregate repeated singles and box picks', () => {
  assert.deepEqual(
    stockRequirements([
      { kind: 'product', productId: 'a', quantity: 2 },
      {
        kind: 'box',
        quantity: 3,
        picks: [
          { productId: 'a', quantity: 2 },
          { productId: 'b', quantity: 6 },
        ],
      },
    ]),
    [
      { productId: 'a', quantity: 8 },
      { productId: 'b', quantity: 18 },
    ],
  );
});
test('production configuration rejects mock payments and weak secrets', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock' }),
    /Invalid server configuration/,
  );
  const good = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:password@cluster.example.com/',
    APP_SECRET: 'a'.repeat(40),
    PUBLIC_SITE_URL: 'https://shop.example.com',
    PAYMENT_PROVIDER: 'stripe',
    PAYMENT_ACCOUNT_MODE: 'per_market',
    PAYMENT_MODE: 'test',
    STRIPE_DE_SECRET_KEY: 'sk_test_example',
    STRIPE_DE_WEBHOOK_SECRET: 'whsec_example',
    STRIPE_GB_SECRET_KEY: 'sk_test_example',
    STRIPE_GB_WEBHOOK_SECRET: 'whsec_example',
    REQUIRE_ADMIN_MFA: 'true',
    SMTP_URL: 'smtps://example.com:465',
    MAIL_FROM: 'shop@example.com',
  };
  assert.equal(loadConfig(good).payments.accountMode, 'per_market');
  assert.throws(() => loadConfig({ ...good, STRIPE_GB_SECRET_KEY: 'sk_live_example' }));
});
test('order numbers use cryptographic randomness and the expected public format', () => {
  const values = Array.from({ length: 200 }, randomOrderNumber);
  assert.equal(new Set(values).size, 200);
  assert.ok(values.every((v) => /^EV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(v)));
});
test('Stripe rejects invalid signatures and normalizes signed currency and account data', () => {
  const stripe = new Stripe('sk_test_example'),
    secret = 'whsec_example';
  const provider = createStripeProvider({
    secretKey: 'sk_test_example',
    webhookSecret: secret,
    publicSiteUrl: 'https://example.com',
    logger: silentLogger,
    client: stripe,
  });
  const body = JSON.stringify({
    id: 'evt_test',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test',
        metadata: { order_id: 'order1' },
        currency: 'eur',
        amount_total: 798,
        payment_status: 'paid',
        payment_intent: 'pi_1',
      },
    },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  assert.equal(
    provider.parseWebhook(Buffer.from(body), { 'stripe-signature': signature }).session.currency,
    'EUR',
  );
  assert.throws(
    () => provider.parseWebhook(Buffer.from(body), { 'stripe-signature': 'wrong' }),
    /Invalid webhook signature/,
  );
});
