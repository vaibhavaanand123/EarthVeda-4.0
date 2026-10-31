import path from 'node:path';
import { z } from 'zod';

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value || '')
      .split(',')
      .map((item) => item.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );
const optionalUrl = z.string().url().optional().or(z.literal('')).default('');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    MONGODB_URI: z
      .string()
      .min(1)
      .default('mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true'),
    MONGODB_DATABASE: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('earthveda'),
    PAYMENT_ACCOUNT_MODE: z.enum(['single', 'per_market']).default('single'),
    PAYMENT_MODE: z.enum(['test', 'live']).default('test'),
    STRIPE_DE_SECRET_KEY: z.string().default(''),
    STRIPE_DE_WEBHOOK_SECRET: z.string().default(''),
    STRIPE_GB_SECRET_KEY: z.string().default(''),
    STRIPE_GB_WEBHOOK_SECRET: z.string().default(''),
    GB_POSTCODE_AREAS: csv,
    REQUIRE_ADMIN_MFA: z.enum(['true', 'false']).default('false'),
    UPLOAD_DIR: z.string().default('./data/uploads'),
    STATIC_DIR: z.string().default('./dist'),
    PUBLIC_SITE_URL: optionalUrl,
    /** Secret for hashing IPs and tokens. 32+ random characters. */
    APP_SECRET: z.string().default(''),

    ADMIN_EMAIL: z.string().email().optional().or(z.literal('')).default(''),
    ADMIN_PASSWORD: z.string().optional().default(''),

    PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).default('mock'),
    STRIPE_SECRET_KEY: z.string().optional().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
    /** Minutes before an unpaid Stripe Checkout session expires (30 to 1440). */
    CHECKOUT_EXPIRES_MINUTES: z.coerce.number().int().min(35).max(1440).default(60),

    SMTP_URL: z.string().optional().default(''),
    MAIL_FROM: z.string().optional().default(''),
    MAIL_REPLY_TO: z.string().optional().default(''),

    WHATSAPP_TOKEN: z.string().optional().default(''),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
    WHATSAPP_API_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/)
      .default('v23.0'),

    ORDER_WEBHOOK_URL: optionalUrl,
    CORS_ORIGINS: csv,
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /** Checkout attempts allowed per IP per 10 minutes. */
    CHECKOUT_RATE_LIMIT: z.coerce.number().int().min(1).max(100000).default(15),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const need = (key, message) => ctx.addIssue({ code: 'custom', path: [key], message });
    if (env.APP_SECRET.startsWith('replace') || env.APP_SECRET.startsWith('dev-only'))
      need('APP_SECRET', 'replace the example secret with a private random value.');
    if (env.APP_SECRET.length < 32) need('APP_SECRET', 'must be at least 32 random characters.');
    if (!env.PUBLIC_SITE_URL) need('PUBLIC_SITE_URL', 'is required in production.');
    if (env.PAYMENT_PROVIDER !== 'stripe')
      need('PAYMENT_PROVIDER', 'must be "stripe" in production.');
    if (!env.PUBLIC_SITE_URL.startsWith('https://')) need('PUBLIC_SITE_URL', 'HTTPS is required.');
    const mongo = (() => {
      try {
        return new URL(env.MONGODB_URI);
      } catch {
        return null;
      }
    })();
    if (
      !mongo ||
      !['mongodb:', 'mongodb+srv:'].includes(mongo.protocol) ||
      !mongo.username ||
      !mongo.password ||
      mongo.searchParams.get('tls') === 'false' ||
      mongo.searchParams.get('ssl') === 'false' ||
      (mongo.protocol === 'mongodb:' && mongo.searchParams.get('tls') !== 'true')
    )
      need('MONGODB_URI', 'production requires authenticated MongoDB over TLS.');
    if (!env.SMTP_URL.startsWith('smtps://'))
      need('SMTP_URL', 'production SMTP must use smtps:// with TLS.');
    const profiles = env.PAYMENT_ACCOUNT_MODE === 'per_market' ? ['DE', 'GB'] : [''];
    for (const profile of profiles) {
      const prefix = profile ? `STRIPE_${profile}_` : 'STRIPE_';
      if (!new RegExp(`^(sk|rk)_${env.PAYMENT_MODE}_`).test(env[`${prefix}SECRET_KEY`]))
        need(`${prefix}SECRET_KEY`, 'must match PAYMENT_MODE.');
      if (!env[`${prefix}WEBHOOK_SECRET`].startsWith('whsec_'))
        need(`${prefix}WEBHOOK_SECRET`, 'is required.');
    }
    if (env.REQUIRE_ADMIN_MFA !== 'true') need('REQUIRE_ADMIN_MFA', 'must be true in production.');
    if (!env.SMTP_URL) need('SMTP_URL', 'is required in production to send order emails.');
    if (!env.MAIL_FROM) need('MAIL_FROM', 'is required in production.');
  });

/** Parse and validate environment variables once, at startup. Fails fast. */
export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid server configuration:\n${issues.join('\n')}`);
  }
  const v = parsed.data;
  return Object.freeze({
    env: v.NODE_ENV,
    isProduction: v.NODE_ENV === 'production',
    isTest: v.NODE_ENV === 'test',
    host: v.HOST,
    port: v.PORT,
    mongodbUri: v.MONGODB_URI,
    mongodbDatabase: v.MONGODB_DATABASE,
    requireAdminMfa: v.REQUIRE_ADMIN_MFA === 'true',
    gbPostcodeAreas: v.GB_POSTCODE_AREAS.map((x) => x.toUpperCase()),
    uploadDir: path.resolve(v.UPLOAD_DIR),
    staticDir: path.resolve(v.STATIC_DIR),
    publicSiteUrl: v.PUBLIC_SITE_URL.replace(/\/$/, '') || `http://localhost:${v.PORT}`,
    appSecret: v.APP_SECRET || 'dev-only-secret-change-me-dev-only-secret',
    bootstrapAdmin: { email: v.ADMIN_EMAIL, password: v.ADMIN_PASSWORD },
    payments: {
      provider: v.PAYMENT_PROVIDER,
      accountMode: v.PAYMENT_ACCOUNT_MODE,
      mode: v.PAYMENT_MODE,
      profiles: {
        primary: { secretKey: v.STRIPE_SECRET_KEY, webhookSecret: v.STRIPE_WEBHOOK_SECRET },
        DE: { secretKey: v.STRIPE_DE_SECRET_KEY, webhookSecret: v.STRIPE_DE_WEBHOOK_SECRET },
        GB: { secretKey: v.STRIPE_GB_SECRET_KEY, webhookSecret: v.STRIPE_GB_WEBHOOK_SECRET },
      },
      stripeSecretKey: v.STRIPE_SECRET_KEY,
      stripeWebhookSecret: v.STRIPE_WEBHOOK_SECRET,
      expiresMinutes: v.CHECKOUT_EXPIRES_MINUTES,
    },
    mail: { smtpUrl: v.SMTP_URL, from: v.MAIL_FROM, replyTo: v.MAIL_REPLY_TO },
    whatsapp: {
      token: v.WHATSAPP_TOKEN,
      phoneNumberId: v.WHATSAPP_PHONE_NUMBER_ID,
      apiVersion: v.WHATSAPP_API_VERSION,
    },
    orderWebhookUrl: v.ORDER_WEBHOOK_URL,
    corsOrigins: v.CORS_ORIGINS,
    trustProxy: v.TRUST_PROXY,
    logLevel: v.LOG_LEVEL,
    checkoutRateLimit: v.CHECKOUT_RATE_LIMIT,
  });
}
