import express, { Router } from 'express';
import { z } from 'zod';
import { statusLabel } from '../../../shared/orderStatus.js';
import { notFound } from '../../lib/errors.js';
import {
  SETTINGS_SCHEMAS,
  changePasswordSchema,
  createUserSchema,
  listQuerySchema,
  loginSchema,
  noteSchema,
  passwordSchema,
  productFlagsSchema,
  productSchema,
  productUpdateSchema,
  refundSchema,
  settingsKeySchema,
  statusUpdateSchema,
  trackingSchema,
  updateUserSchema,
} from '../../services/schemas.js';
import {
  ADMIN_COOKIE,
  handle,
  createLimiter,
  noStore,
  requireAdmin,
  requireOwner,
  sessionCookie,
  validate,
} from '../middleware.js';
const csvCell = (value) => {
  const text = String(value ?? '');
  // Prefix formula-leading characters so spreadsheets never execute them.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const sendCsv = (res, name, header, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.send(`\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}`);
};
const euros = (cents) => (Number.isFinite(cents) ? (cents / 100).toFixed(2) : '');
const idParam = z.coerce.number().int().min(1);
export function adminRouter(deps) {
  const {
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
  } = deps;
  const router = Router();
  const limiter = createLimiter(db, 'admin');
  router.use(noStore);
  const siteOrigin = new URL(config.publicSiteUrl).origin;
  const cookieOpts = {
    secure: config.isProduction,
    maxAgeSeconds: authService.SESSION_HOURS * 3600,
  };

  // ---------- auth ----------
  router.post(
    '/login',
    limiter(15, 20),
    // Per-account limit on top of the per-IP one (slows down password spraying).
    limiter(
      15,
      8,
      (req) =>
        `login:${String(req.body?.email || '')
          .toLowerCase()
          .slice(0, 254)}`,
    ),
    (req, res, next) => (req.get('x-ev-admin') === '1' ? next() : res.status(403).end()),
    validate(loginSchema),
    async (req, res) => {
      const { token, user } = await authService.login({
        ...req.valid.body,
        userAgent: req.get('user-agent'),
      });
      res.setHeader('Set-Cookie', sessionCookie(token, cookieOpts));
      res.json({
        user,
      });
    },
  );
  const auth = requireAdmin({
    authService,
    siteOrigin,
    additionalOrigins: config.corsOrigins,
  });
  router.use(limiter(1, 300));
  router.post('/logout', auth, async (req, res) => {
    await authService.logout(req.sessionToken);
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    res.json({
      ok: true,
    });
  });
  router.get('/me', auth, (req, res) =>
    res.json({
      user: req.user,
    }),
  );
  router.post('/me/password', auth, validate(changePasswordSchema), async (req, res) => {
    await authService.changeOwnPassword(req.user, req.valid.body);
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    res.json({
      ok: true,
    });
  });
  router.post(
    '/me/mfa/setup',
    auth,
    validate(z.object({ password: z.string().min(1).max(200) })),
    async (req, res) => res.json(await authService.beginMfa(req.user, req.valid.body.password)),
  );
  router.post(
    '/me/mfa/confirm',
    auth,
    validate(z.object({ otp: z.string().regex(/^\d{6}$/) })),
    async (req, res) => {
      await authService.confirmMfa(req.user, req.valid.body.otp);
      res.setHeader(
        'Set-Cookie',
        `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`,
      );
      res.json({ ok: true });
    },
  );
  router.use(auth);
  const actor = (req) => req.user.email;

  // ---------- orders ----------
  router.get('/summary', async (_req, res) =>
    res.json({
      summary: await orderService.summary(),
    }),
  );
  router.get('/orders/feed', async (req, res) => {
    const since = z
      .string()
      .datetime()
      .catch(new Date(Date.now() - 60_000).toISOString())
      .parse(req.query.since);
    res.json({
      orders: await orderService.paidSince(since),
      now: new Date().toISOString(),
    });
  });
  router.get('/orders', validate(listQuerySchema, 'query'), async (req, res) =>
    res.json(await orderService.list(req.valid.query)),
  );
  router.get('/orders.csv', requireOwner, validate(listQuerySchema, 'query'), async (req, res) => {
    const orders = [];
    for (let offset = 0; offset < 100_000; offset += 200) {
      const page = (
        await orderService.list({
          ...req.valid.query,
          limit: 200,
          offset,
        })
      ).orders;
      orders.push(...page);
      if (page.length < 200) break;
    }
    sendCsv(
      res,
      'earthveda-orders',
      [
        'order_number',
        'created_at',
        'paid_at',
        'status',
        'country',
        'subtotal',
        'shipping',
        'discount',
        'total',
        'paid',
        'refunded',
        'vat',
        'first_name',
        'last_name',
        'company',
        'email',
        'phone',
        'street',
        'address2',
        'postal_code',
        'city',
        'items',
        'note',
        'tracking',
      ],
      orders.map((o) => [
        o.orderNumber,
        o.createdAt,
        o.paidAt,
        statusLabel(o.status, 'de'),
        o.country,
        euros(o.subtotal),
        euros(o.shipping),
        euros(o.discount),
        euros(o.total),
        euros(o.amountPaid),
        euros(o.amountRefunded),
        o.vat.map((v) => `${v.rate}%: ${euros(v.amount)}`).join(' | '),
        o.customer.firstName,
        o.customer.lastName,
        o.customer.company,
        o.customer.email,
        o.customer.phone,
        o.customer.street,
        o.customer.address2,
        o.customer.postalCode,
        o.customer.city,
        o.lines
          .map(
            (l) =>
              `${l.quantity}x ${l.sku}${l.picks ? ` [${l.picks.map((p) => `${p.quantity}x ${p.sku}`).join(' ')}]` : ''}`,
          )
          .join(' | '),
        o.note,
        [o.tracking.carrier, o.tracking.number].filter(Boolean).join(' '),
      ]),
    );
  });
  router.get('/orders/:orderNumber', async (req, res) =>
    res.json({
      order: await orderService.get(req.params.orderNumber),
    }),
  );
  router.patch(
    '/orders/:orderNumber/status',
    validate(statusUpdateSchema),
    handle(async (req, res) =>
      res.json({
        order: await orderService.updateStatus(req.params.orderNumber, req.valid.body, actor(req)),
      }),
    ),
  );
  router.put('/orders/:orderNumber/tracking', validate(trackingSchema), async (req, res) =>
    res.json({
      order: await orderService.setTracking(req.params.orderNumber, req.valid.body, actor(req)),
    }),
  );
  router.put('/orders/:orderNumber/note', validate(noteSchema), async (req, res) =>
    res.json({
      order: await orderService.setInternalNote(
        req.params.orderNumber,
        req.valid.body.note,
        actor(req),
      ),
    }),
  );
  router.post(
    '/orders/:orderNumber/refund',
    requireOwner,
    validate(
      refundSchema.extend({
        cancel: z.boolean().optional().default(false),
      }),
    ),
    handle(async (req, res) =>
      res.json({
        order: await orderService.refund(req.params.orderNumber, req.valid.body, actor(req)),
      }),
    ),
  );

  // ---------- products ----------
  router.get('/products', async (_req, res) =>
    res.json({
      products: await catalogService.adminList(),
    }),
  );
  router.get('/products/:id', async (req, res) =>
    res.json({
      product: await catalogService.getProduct(req.params.id),
    }),
  );
  router.post('/products', validate(productSchema), async (req, res) =>
    res.status(201).json({
      product: await catalogService.createProduct(req.valid.body, req.user),
    }),
  );
  router.put('/products/:id', validate(productUpdateSchema), async (req, res) =>
    res.json({
      product: await catalogService.updateProduct(req.params.id, req.valid.body, req.user),
    }),
  );
  router.patch('/products/:id', validate(productFlagsSchema), async (req, res) =>
    res.json({
      product: await catalogService.setFlags(req.params.id, req.valid.body, req.user),
    }),
  );
  router.post('/products/:id/archive', async (req, res) =>
    res.json({
      product: await catalogService.archiveProduct(req.params.id, req.user),
    }),
  );
  router.post('/products/:id/restore', async (req, res) =>
    res.json({
      product: await catalogService.restoreProduct(req.params.id, req.user),
    }),
  );
  router.post(
    '/uploads',
    express.raw({
      type: ['image/*', 'application/octet-stream'],
      limit: mediaService.MAX_BYTES + 1024,
    }),
    handle(async (req, res) => res.status(201).json(await mediaService.saveImage(req.body))),
  );

  router.post(
    '/skus',
    validate(z.object({ range: z.enum(['foxnuts', 'protein']) })),
    async (req, res) => res.json({ sku: await catalogService.generateSku(req.valid.body.range) }),
  );
  router.get('/inventory', async (_req, res) =>
    res.json({ inventory: await inventory.list(), products: await catalogService.adminList() }),
  );
  router.post(
    '/inventory/adjust',
    validate(
      z.object({
        productId: z.string().min(1).max(80),
        country: z.enum(['DE', 'GB']),
        delta: z
          .number()
          .int()
          .min(-1000000)
          .max(1000000)
          .refine((n) => n !== 0),
        reason: z.string().trim().min(3).max(200),
        operationId: z.string().uuid(),
      }),
    ),
    async (req, res) => {
      const value = await db.transaction(async () => {
        await catalogService.getProduct(req.valid.body.productId);
        const value = await inventory.adjust(req.valid.body, actor(req));
        await authService.audit(
          actor(req),
          'inventory.adjust',
          'product',
          req.valid.body.productId,
          req.valid.body,
        );
        return value;
      });
      catalogService.invalidate();
      res.json({ inventory: value });
    },
  );
  router.get('/jobs', requireOwner, async (_req, res) =>
    res.json({ jobs: await jobs.recent(100) }),
  );
  router.post('/jobs/:id/retry', requireOwner, async (req, res) => {
    if (!(await jobs.retryFailed(z.string().uuid().parse(req.params.id), new Date().toISOString())))
      throw notFound('Only failed jobs can be retried.');
    res.json({ ok: true });
  });

  // ---------- settings ----------
  router.get('/settings', (_req, res) =>
    res.json({
      settings: catalogService.settings(),
    }),
  );
  router.put('/settings/:key', requireOwner, async (req, res) => {
    const key = settingsKeySchema.parse(req.params.key);
    const value = SETTINGS_SCHEMAS[key].parse(req.body); // validation errors surface as 400
    res.json({
      value: await catalogService.updateSetting(key, value, req.user),
    });
  });

  // ---------- newsletter ----------
  router.get('/subscribers', requireOwner, async (req, res) => {
    const q = z
      .object({
        status: z.enum(['pending', 'confirmed', 'unsubscribed']).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);
    res.json(await newsletterService.list(q));
  });
  router.get('/subscribers.csv', requireOwner, async (_req, res) => {
    const { subscribers } = await newsletterService.list({
      status: 'confirmed',
      limit: 1_000_000,
    });
    sendCsv(
      res,
      'earthveda-newsletter',
      ['email', 'language', 'source', 'subscribed_at', 'confirmed_at', 'consent_text'],
      subscribers.map((s) => [
        s.email,
        s.lang,
        s.source,
        s.createdAt,
        s.confirmedAt,
        s.consentText,
      ]),
    );
  });
  router.delete('/subscribers/:id', requireOwner, async (req, res) => {
    if (!(await newsletterService.remove(idParam.parse(req.params.id), req.user)))
      throw notFound('Subscriber not found.');
    res.json({
      ok: true,
    });
  });

  // ---------- withdrawals ----------
  router.get('/withdrawals', async (_req, res) =>
    res.json(
      await withdrawalService.list({
        limit: 200,
      }),
    ),
  );
  router.patch(
    '/withdrawals/:id',
    validate(
      z.object({
        handled: z.boolean(),
      }),
    ),
    async (req, res) => {
      if (
        !(await withdrawalService.setHandled(
          idParam.parse(req.params.id),
          req.valid.body.handled,
          req.user,
        ))
      )
        throw notFound('Withdrawal not found.');
      res.json({
        ok: true,
      });
    },
  );

  // ---------- notifications ----------
  router.get('/notifications', async (_req, res) =>
    res.json({
      notifications: await outbox.recent(100),
    }),
  );
  router.post('/notifications/:id/retry', async (req, res) => {
    if (
      !(await outbox.retryFailed(z.string().uuid().parse(req.params.id), new Date().toISOString()))
    )
      throw notFound('Only failed notifications can be retried.');
    res.json({
      ok: true,
    });
  });

  // ---------- team (owners only) ----------
  router.get('/users', requireOwner, async (_req, res) =>
    res.json({
      users: await authService.listUsers(),
    }),
  );
  router.post('/users', requireOwner, validate(createUserSchema), async (req, res) =>
    res.status(201).json({
      user: await authService.createUser(req.valid.body, req.user),
    }),
  );
  router.put('/users/:id', requireOwner, validate(updateUserSchema), async (req, res) =>
    res.json({
      user: await authService.updateUser(req.params.id, req.valid.body, req.user),
    }),
  );
  router.post(
    '/users/:id/password',
    requireOwner,
    validate(
      z.object({
        password: passwordSchema,
      }),
    ),
    async (req, res) => {
      await authService.resetPassword(req.params.id, req.valid.body.password, req.user);
      res.json({
        ok: true,
      });
    },
  );
  router.get('/audit', requireOwner, async (_req, res) =>
    res.json({
      entries: await authService.auditLog(200),
    }),
  );
  return router;
}
