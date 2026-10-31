import { z } from 'zod';
import { RANGES } from '../../shared/catalog.js';
import { COUNTRIES, LANGS, isValidPostcode, toE164 } from '../../shared/markets.js';
import { ORDER_LIMITS } from '../../shared/pricing.js';
import { ORDER_STATUSES } from '../../shared/orderStatus.js';

// Reject control characters that could corrupt CSV exports, emails or messages.
// eslint-disable-next-line no-control-regex -- deliberately matching control characters
const CONTROL_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const clean = (schema) =>
  schema.refine((v) => !CONTROL_CHARS.test(v), 'Contains invalid characters.');
const text = (min, max) => clean(z.string().trim().min(min).max(max));
const optionalText = (max) => clean(z.string().trim().max(max)).optional().default('');
const email = z.string().trim().toLowerCase().max(254).email('Please enter a valid email address.');
const lang = z.enum(LANGS);
const country = z.enum(Object.keys(COUNTRIES));
const cents = z.number().int().min(0).max(10_000_000);

// ---------- storefront ----------

const basketSchema = {
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(80),
        quantity: z.number().int().min(1).max(ORDER_LIMITS.maxQuantityPerLine),
      }),
    )
    .max(ORDER_LIMITS.maxLines)
    .default([]),
  boxes: z
    .array(
      z.object({
        bundleId: z.string().min(1).max(40),
        quantity: z.number().int().min(1).max(ORDER_LIMITS.maxBoxQuantity),
        picks: z
          .array(
            z.object({
              productId: z.string().min(1).max(80),
              quantity: z.number().int().min(1).max(48),
            }),
          )
          .min(1)
          .max(ORDER_LIMITS.maxPicksPerBox),
      }),
    )
    .max(ORDER_LIMITS.maxLines)
    .default([]),
};

export const quoteSchema = z.object({ country, lang: lang.default('de'), ...basketSchema });

export const checkoutSchema = z
  .object({
    lang,
    country,
    ...basketSchema,
    // Optional during a rolling deployment; the current storefront always sends this.
    expectedTotal: cents.optional(),
    customer: z.object({
      email,
      firstName: text(1, 80),
      lastName: text(1, 80),
      company: optionalText(120),
      phone: text(6, 24),
      street: text(3, 160),
      address2: optionalText(120),
      postalCode: text(3, 10),
      city: text(2, 100),
    }),
    note: optionalText(300),
    whatsappOptIn: z.boolean().optional().default(false),
    newsletterOptIn: z.boolean().optional().default(false),
    acceptTerms: z.literal(true, { error: 'Please accept the terms.' }),
    /** Honeypot: real shoppers never see or fill this field. */
    website: z.string().max(0, 'Invalid submission.').optional().default(''),
  })
  .superRefine((order, ctx) => {
    if (order.items.length + order.boxes.length === 0)
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Your bag is empty.' });
    if (!isValidPostcode(order.customer.postalCode, order.country))
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'postalCode'],
        message: COUNTRIES[order.country].postal.hint[order.lang],
      });
    if (!toE164(order.customer.phone, order.country))
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'phone'],
        message:
          order.lang === 'de'
            ? 'Bitte gib eine gültige Telefonnummer mit Ländervorwahl ein.'
            : 'Enter a valid phone number including the country code.',
      });
  });

export const orderNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^EV-[0-9A-Z]{8}$/, 'Enter the order number from your confirmation, e.g. EV-7K3M9Q2A.');

export const lookupSchema = z.object({ orderNumber: orderNumberSchema, email });

export const statusQuerySchema = z.object({ session_id: z.string().min(8).max(255) });

export const newsletterSchema = z.object({
  email,
  lang: lang.default('de'),
  source: z.enum(['footer', 'home', 'checkout', 'popup']).default('footer'),
  website: z.string().max(0).optional().default(''),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(100) });

export const withdrawalSchema = z.object({
  name: text(2, 120),
  orderNumber: text(3, 40),
  email,
  scope: optionalText(500),
  lang: lang.default('de'),
  website: z.string().max(0).optional().default(''),
});

// ---------- admin ----------

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal('')),
});

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Use letters and numbers.');

export const createUserSchema = z.object({
  email,
  name: text(2, 80),
  role: z.enum(['owner', 'staff']),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  name: text(2, 80),
  role: z.enum(['owner', 'staff']),
  active: z.boolean(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const listQuerySchema = z.object({
  status: z.enum([...ORDER_STATUSES, 'open']).optional(),
  search: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(300),
  notifyCustomer: z.boolean().optional().default(true),
});

export const trackingSchema = z.object({
  carrier: optionalText(40),
  number: optionalText(80),
  url: z.string().trim().url().max(500).optional().or(z.literal('')).default(''),
});

export const noteSchema = z.object({ note: optionalText(2000) });
export const refundSchema = z.object({
  amount: cents.min(1).optional(),
  reason: optionalText(300),
});

const productText = z.object({
  name: text(1, 80),
  fullName: text(1, 160),
  description: text(1, 1200),
  ingredients: optionalText(2000),
  allergens: optionalText(500),
  storage: optionalText(300),
  howToEnjoy: optionalText(500),
  highlights: z.array(text(1, 60)).max(6).default([]),
});

const nutrient = z.number().min(0).max(5000);
export const productSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
    .min(2)
    .max(80),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, 'Use capital letters, numbers and hyphens.')
    .or(z.literal(''))
    .optional()
    .default(''),
  range: z.enum(Object.keys(RANGES)),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #2f6b35.'),
  image: z
    .string()
    .regex(/^\/(images|uploads)\/[\w.-]+\.(webp|png|jpe?g)$/, 'Upload an image first.'),
  price: cents.min(1).max(1_000_000),
  vat: z.object(
    Object.fromEntries(Object.keys(COUNTRIES).map((c) => [c, z.number().min(0).max(30)])),
  ),
  netWeightGrams: z.number().int().min(1).max(100_000).nullable().default(null),
  inStock: z.boolean(),
  active: z.boolean(),
  featured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  bundleEligible: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
  i18n: z.object({ de: productText, en: productText }),
  nutrition: z
    .object({
      energyKj: nutrient,
      energyKcal: nutrient,
      fat: nutrient,
      saturates: nutrient,
      carbs: nutrient,
      sugars: nutrient,
      fibre: nutrient,
      protein: nutrient,
      salt: nutrient,
    })
    .nullable()
    .default(null),
});

export const productUpdateSchema = productSchema.extend({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/),
  version: z.number().int().min(1),
});

export const productFlagsSchema = z.object({
  inStock: z.boolean().optional(),
  active: z.boolean().optional(),
  version: z.number().int().min(1),
});

const i18nText = (max) => z.object({ de: text(1, max), en: text(1, max) });

export const SETTINGS_SCHEMAS = {
  shipping: z.object(
    Object.fromEntries(
      Object.keys(COUNTRIES).map((c) => [
        c,
        z.object({
          fee: cents.max(100_00),
          freeFrom: cents.max(10_000_00).nullable(),
          eta: i18nText(60),
          carrier: optionalText(40),
        }),
      ]),
    ),
  ),
  bundles: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{2,40}$/),
        sku: z.string().regex(/^[A-Z0-9-]{3,40}$/),
        size: z
          .number()
          .int()
          .min(2)
          .max(48)
          .refine((n) => n % 2 === 0, 'Boxes hold pairs of packs, so use an even number.'),
        price: cents.min(1).max(1_000_000),
        active: z.boolean(),
        name: i18nText(80),
      }),
    )
    .max(6)
    .refine(
      (list) => new Set(list.map((b) => b.id)).size === list.length,
      'Box ids must be unique.',
    ),
  story: z.object({
    isPlaceholder: z.boolean(),
    ...Object.fromEntries(
      LANGS.map((l) => [
        l,
        z.object({
          eyebrow: text(1, 60),
          title: text(1, 160),
          paragraphs: z.array(text(1, 2000)).min(1).max(12),
          signature: optionalText(80),
        }),
      ]),
    ),
  }),
  business: z.object({
    brand: text(1, 80),
    legalName: optionalText(120),
    legalForm: optionalText(60),
    street: optionalText(120),
    postalCode: optionalText(12),
    city: optionalText(80),
    country: optionalText(60),
    email: z.string().trim().max(254).email().or(z.literal('')),
    phone: optionalText(40),
    managingDirectors: optionalText(200),
    registerCourt: optionalText(80),
    registerNumber: optionalText(40),
    vatId: optionalText(30),
    ukVatNumber: optionalText(30),
    contentResponsible: optionalText(200),
    packagingRegister: optionalText(60),
    foodBusinessOperator: optionalText(300),
    instagram: z.string().trim().url().max(200).or(z.literal('')),
    supportHours: i18nText(80),
  }),
  notifications: z.object({
    merchantEmails: z.array(email).max(10),
    merchantWhatsApp: z
      .array(
        z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Use international format, e.g. +4915112345678.'),
      )
      .max(5),
  }),
  newsletter: z.object({
    welcomeCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{0,40}$/),
    incentive: i18nText(160),
  }),
};

export const settingsKeySchema = z.enum(Object.keys(SETTINGS_SCHEMAS));
