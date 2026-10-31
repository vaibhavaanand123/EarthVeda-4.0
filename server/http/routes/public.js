import { Router } from 'express';
import { badRequest, notFound } from '../../lib/errors.js';
import {
  checkoutSchema,
  lookupSchema,
  newsletterSchema,
  orderNumberSchema,
  quoteSchema,
  statusQuerySchema,
  tokenSchema,
  withdrawalSchema,
} from '../../services/schemas.js';
import { handle, createLimiter, noStore, validate } from '../middleware.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Storefront API: catalogue, checkout, order status, newsletter, withdrawal. */
export function publicRouter({
  config,
  db,
  catalogService,
  orderService,
  newsletterService,
  withdrawalService,
}) {
  const api = Router();
  const limiter = createLimiter(db, 'public');
  api.get('/health', noStore, (_req, res) =>
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
    }),
  );

  api.get('/ready', noStore, async (_req, res) => {
    await db.ping();
    const schema = await db.collection('settings').findOne({ _id: '_schema' });
    if (schema?.value !== 1) return res.status(503).json({ status: 'not_ready' });
    res.json({ status: 'ready' });
  });

  // One payload for the whole storefront: products, boxes, shipping, story, business info.
  api.get('/storefront', async (_req, res) => {
    await catalogService.refresh();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.type('application/json').send(catalogService.storefront());
  });
  api.post('/quote', noStore, limiter(1, 120), validate(quoteSchema), async (req, res) => {
    res.json({
      quote: await orderService.quote(req.valid.body),
    });
  });
  api.post(
    '/checkout',
    noStore,
    limiter(10, config.checkoutRateLimit),
    validate(checkoutSchema),
    handle(async (req, res) => {
      const idempotencyKey = req.get('idempotency-key') || '';
      if (!UUID.test(idempotencyKey))
        throw badRequest('idempotency_key_required', 'A valid Idempotency-Key header is required.');
      const result = await orderService.startCheckout(req.valid.body, {
        idempotencyKey,
        clientIp: req.ip,
      });
      res.status(201).json(result);
    }),
  );
  api.get(
    '/orders/:orderNumber/status',
    noStore,
    limiter(1, 60),
    validate(statusQuerySchema, 'query'),
    handle(async (req, res) => {
      const orderNumber = orderNumberSchema.parse(req.params.orderNumber);
      res.json({
        order: await orderService.statusForCustomer(orderNumber, req.valid.query.session_id),
      });
    }),
  );
  api.post('/orders/lookup', noStore, limiter(10, 30), validate(lookupSchema), async (req, res) => {
    res.json({
      order: await orderService.lookup(req.valid.body),
    });
  });

  // Newsletter (double opt-in). Same response whether or not the address exists.
  api.post(
    '/newsletter/subscribe',
    noStore,
    limiter(10, 8),
    validate(newsletterSchema),
    async (req, res) => {
      const { email, lang, source } = req.valid.body;
      await newsletterService.subscribe(
        {
          email,
          lang,
          source,
        },
        req.ip,
      );
      res.status(202).json({
        ok: true,
      });
    },
  );
  api.post(
    '/newsletter/confirm',
    noStore,
    limiter(10, 30),
    validate(tokenSchema),
    async (req, res) => {
      const result = await newsletterService.confirm(req.valid.body.token);
      if (!result.ok) throw notFound('This confirmation link is invalid or has expired.');
      res.json(result);
    },
  );
  // POST from our page and RFC 8058 one-click (token in the query string).
  api.post('/newsletter/unsubscribe', noStore, limiter(10, 30), async (req, res) => {
    const { token } = tokenSchema.parse({
      token: req.body?.token || req.query.token,
    });
    await newsletterService.unsubscribe(token);
    res.json({
      ok: true,
    });
  });

  // Online withdrawal function (§ 356a BGB): no login, no reason required.
  api.post(
    '/withdrawals',
    noStore,
    limiter(10, 10),
    validate(withdrawalSchema),
    async (req, res) => {
      res.status(201).json(await withdrawalService.submit(req.valid.body, req.ip));
    },
  );

  // Dev only: lets the mock payment page simulate the provider's webhook.
  if (config.payments.provider === 'mock' && !config.isProduction)
    api.post('/dev/mock-payment', noStore, async (req, res) => {
      res.json(
        await orderService.simulatePayment({
          sessionId: String(req.body?.sessionId || ''),
          outcome: req.body?.outcome,
        }),
      );
    });
  return api;
}
