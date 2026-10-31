import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { localiseProduct } from '../shared/catalog.js';
import { LANGS } from '../shared/markets.js';
import { ROUTES, langFromPath, matchRoute, path as routePath } from '../shared/routes.js';
import { createProductRepository } from './db/productRepository.js';
import { createSettingsRepository } from './db/settingsRepository.js';
import { createOrderRepository } from './db/orderRepository.js';
import { createOutboxRepository } from './db/outboxRepository.js';
import {
  createAdminRepository,
  createSubscriberRepository,
  createWebhookEventRepository,
  createWithdrawalRepository,
} from './db/miscRepositories.js';
import { cors, errorHandler, requestContext } from './http/middleware.js';
import { adminRouter } from './http/routes/admin.js';
import { publicRouter } from './http/routes/public.js';
import { webhookRouter } from './http/routes/webhooks.js';
import { notFound } from './lib/errors.js';
import {
  createEmailChannel,
  createWebhookChannel,
  createWhatsAppChannel,
} from './notifications/channels.js';
import { createDispatcher } from './notifications/dispatcher.js';
import { createNotifier } from './notifications/notifier.js';
import { buildWhatsAppTemplate, renderEmail } from './notifications/templates.js';
import { createMarketProvider } from './payments/marketProvider.js';
import { createInventoryRepository } from './db/inventoryRepository.js';
import { createAuthService } from './services/authService.js';
import { createCatalogService } from './services/catalogService.js';
import { createMediaService } from './services/mediaService.js';
import { createNewsletterService } from './services/newsletterService.js';
import { createOrderService } from './services/orderService.js';
import { createWithdrawalService } from './services/withdrawalService.js';

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

const DEFAULT_META = {
  de: {
    title: 'Earthveda Essentials | Geröstete Makhana & Plant Protein',
    description:
      'Geröstete, nicht frittierte Fuchsnüsse (Makhana) in sieben Sorten und pflanzliches Protein aus gerösteten Kichererbsen. Versand nach Deutschland und UK.',
  },
  en: {
    title: 'Earthveda Essentials | Roasted Makhana & Plant Protein',
    description:
      'Roasted, never fried foxnuts (makhana) in seven flavours and plant protein from roasted chickpeas. Delivered across Germany and the UK.',
  },
};

/**
 * Composition root: builds repositories → services → HTTP. Every dependency
 * can be replaced (tests inject an in-memory DB, fake channels and the mock
 * payment provider).
 */
export async function createApp({
  config,
  db,
  logger,
  channels: channelOverrides,
  payments: paymentsOverride,
  now,
}) {
  const clock = now ?? (() => new Date());

  // Repositories
  const productRepository = createProductRepository(db);
  const settingsRepository = createSettingsRepository(db);
  const orderRepository = createOrderRepository(db);
  const outbox = createOutboxRepository(db);
  const adminRepository = createAdminRepository(db);
  const inventory = createInventoryRepository(db);
  const jobs = createOutboxRepository(db, 'jobs');

  // Services
  const authService = createAuthService({ adminRepository, config, logger, now: clock });
  const audit = authService.audit;
  const catalogService = createCatalogService({
    productRepository,
    inventory,
    config,
    settingsRepository,
    audit,
    now: () => clock().toISOString(),
  });
  await catalogService.refresh(true);
  const notifier = createNotifier({
    outbox,
    settings: () => catalogService.settings(),
    config,
    now: clock,
  });
  const payments = paymentsOverride ?? createMarketProvider({ config, db, logger });
  const newsletterService = createNewsletterService({
    db,
    subscriberRepository: createSubscriberRepository(db),
    notifier,
    config,
    audit,
    now: clock,
  });
  const withdrawalService = createWithdrawalService({
    db,
    withdrawalRepository: createWithdrawalRepository(db),
    notifier,
    config,
    audit,
    now: clock,
  });
  const orderService = createOrderService({
    orderRepository,
    db,
    jobs,
    webhookEvents: createWebhookEventRepository(db),
    catalogService,
    payments,
    notifier,
    newsletterService,
    config,
    logger,
    audit,
    now: clock,
  });
  const mediaService = createMediaService({ uploadDir: config.uploadDir, db });

  const channels = {
    email: createEmailChannel({
      smtpUrl: config.mail.smtpUrl,
      from: config.mail.from,
      replyTo: config.mail.replyTo,
      render: renderEmail,
    }),
    whatsapp: createWhatsAppChannel({ ...config.whatsapp, buildTemplate: buildWhatsAppTemplate }),
    webhook: createWebhookChannel({ url: config.orderWebhookUrl }),
    ...channelOverrides,
  };
  const dispatcher = createDispatcher({ outbox, channels, logger, now: clock });
  const jobDispatcher = createDispatcher({
    outbox: jobs,
    channels: { refund: { configured: true, send: (m) => orderService.performRefundJob(m) } },
    logger,
    now: clock,
  });

  // HTTP
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(requestContext(logger));
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'", 'https://checkout.stripe.com'],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: config.isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
    );
    next();
  });
  app.use(compression());

  // Webhooks need the raw body, so they are mounted before the JSON parser.
  app.use('/api/webhooks', webhookRouter({ orderService, logger }));
  if (config.corsOrigins.length) app.use('/api', cors(config.corsOrigins));
  app.use('/api', express.json({ limit: '100kb' }));
  app.use(
    '/api/admin',
    adminRouter({
      config,
      db,
      inventory,
      jobs,
      authService,
      orderService,
      catalogService,
      newsletterService,
      withdrawalService,
      mediaService,
      outbox,
    }),
  );
  app.use(
    '/api',
    publicRouter({
      config,
      db,
      catalogService,
      orderService,
      newsletterService,
      withdrawalService,
    }),
  );
  app.use('/api', (_req, _res, next) => next(notFound('Unknown API route.')));

  // Uploaded product images: content-addressed, cache forever.
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      immutable: true,
      maxAge: '365d',
      index: false,
      fallthrough: false,
    }),
  );

  const site = config.publicSiteUrl;
  app.get('/robots.txt', (_req, res) => {
    res
      .type('text/plain')
      .send(
        [
          'User-agent: *',
          'Disallow: /admin',
          'Disallow: /api/',
          'Disallow: /kasse',
          'Disallow: /en/checkout',
          `Sitemap: ${site}/sitemap.xml`,
        ].join('\n'),
      );
  });
  app.get('/sitemap.xml', (_req, res) => {
    const pages = [
      'home',
      'shop',
      'box',
      'story',
      'faq',
      'contact',
      'imprint',
      'terms',
      'withdrawal',
      'privacy',
      'shipping',
      'accessibility',
    ].map((key) => ({ key }));
    const products = catalogService
      .liveSlugs()
      .map((slug) => ({ key: 'product', params: { slug } }));
    const urls = [...pages, ...products]
      .map(({ key, params }) => {
        const alts = LANGS.map(
          (l) =>
            `<xhtml:link rel="alternate" hreflang="${l}" href="${site}${routePath(key, l, params)}"/>`,
        ).join('');
        return LANGS.map(
          (l) =>
            `<url><loc>${site}${routePath(key, l, params)}</loc>${alts}<xhtml:link rel="alternate" hreflang="x-default" href="${site}${routePath(key, 'de', params)}"/></url>`,
        ).join('');
      })
      .join('');
    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
      );
  });

  // Built storefront: hashed assets are immutable; HTML is always revalidated.
  const indexFile = path.join(config.staticDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    const template = fs.readFileSync(indexFile, 'utf8');
    app.use(
      express.static(config.staticDir, {
        index: false,
        setHeaders(res, file) {
          if (file.includes(`${path.sep}assets${path.sep}`))
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (file.includes(`${path.sep}images${path.sep}`))
            res.setHeader('Cache-Control', 'public, max-age=604800');
        },
      }),
    );
    // SPA fallback with per-page <title>, description, lang and hreflang for SEO and link previews.
    app.get(/^\/(?!api\/|uploads\/|assets\/).*/, (req, res) => {
      const lang = langFromPath(req.path);
      const match = matchRoute(req.path);
      let { title, description } = DEFAULT_META[lang];
      let image = '/images/cream-onion.webp';
      let status = match ? 200 : 404;
      if (match?.key === 'product') {
        const product = catalogService.findBySlug(match.params.slug);
        if (product?.active) {
          const p = localiseProduct(product, lang);
          title = `${p.fullName} | Earthveda Essentials`;
          description = p.description;
          image = p.image;
        } else status = 404;
      }
      if (req.path.startsWith('/admin')) {
        status = 200;
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      const alternates = match
        ? LANGS.map(
            (l) =>
              `<link rel="alternate" hreflang="${l}" href="${site}${routePath(match.key, l, match.params)}">`,
          ).join('') +
          `<link rel="alternate" hreflang="x-default" href="${site}${routePath(match.key, 'de', match.params)}">` +
          `<link rel="canonical" href="${site}${routePath(match.key, lang, match.params)}">`
        : '';
      const html = template
        .replace('<html lang="de">', () => `<html lang="${lang}">`)
        .replace(
          /<meta name="robots"[^>]*>/s,
          () =>
            `<meta name="robots" content="${status >= 400 || req.path.startsWith('/admin') || ['cart', 'checkout', 'orderSuccess', 'track', 'withdraw', 'newsletterConfirm', 'newsletterUnsubscribe', 'mockPay'].includes(match?.key) ? 'noindex, nofollow' : 'index, follow'}">`,
        )
        .replace(/<title>.*?<\/title>/s, () => `<title>${esc(title)}</title>`)
        .replace(
          /<meta name="description"[^>]*>/s,
          () => `<meta name="description" content="${esc(description)}">`,
        )
        .replace(
          '</head>',
          () =>
            `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${site}${esc(image)}"><meta property="og:url" content="${site}${esc(req.path)}"><meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_GB'}">${alternates}</head>`,
        );
      res.status(status).setHeader('Cache-Control', 'no-cache');
      res.type('html').send(html);
    });
  }

  app.use(errorHandler(logger));

  return {
    app,
    services: {
      authService,
      catalogService,
      orderService,
      newsletterService,
      withdrawalService,
      notifier,
    },
    dispatcher,
    jobDispatcher,
    inventory,
    jobs,
    outbox,
    payments,
    routes: ROUTES,
  };
}
