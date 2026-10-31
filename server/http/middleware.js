import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { AppError, forbidden, unauthorized } from '../lib/errors.js';
import { parseCookies } from '../lib/security.js';
export const ADMIN_COOKIE = 'ev_admin';
export function requestContext(logger) {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      if (!req.path.startsWith('/api')) return;
      logger.info('request', {
        reqId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
      });
    });
    next();
  };
}

/** Explicit allow-list CORS, only needed when the storefront runs on another origin. */
export function cors(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && allowed.has(origin) ? 204 : 403);
    next();
  };
}
export function createLimiter(db, namespace) {
  let sequence = 0;
  return (windowMinutes, limit, keyGenerator) => {
    const prefix = `${namespace}:${sequence++}`;
    let windowMs = windowMinutes * 60000;
    const idFor = (key) =>
      `${prefix}:${crypto.createHash('sha256').update(key).digest('hex')}:${Math.floor(Date.now() / windowMs)}`;
    const store = {
      init(options) {
        windowMs = options.windowMs;
      },
      async increment(key) {
        const resetTime = new Date((Math.floor(Date.now() / windowMs) + 1) * windowMs);
        const row = await db
          .collection('rateLimits')
          .findOneAndUpdate(
            { _id: idFor(key) },
            { $inc: { hits: 1 }, $setOnInsert: { expiresAt: resetTime } },
            { upsert: true, returnDocument: 'after' },
          );
        return { totalHits: row.hits, resetTime };
      },
      async decrement(key) {
        await db
          .collection('rateLimits')
          .updateOne({ _id: idFor(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
      },
      async resetKey(key) {
        await db.collection('rateLimits').deleteOne({ _id: idFor(key) });
      },
    };
    return rateLimit({
      windowMs,
      limit,
      store,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      ...(keyGenerator ? { keyGenerator } : {}),
      message: { error: { code: 'rate_limited', message: 'Too many attempts. Please wait.' } },
    });
  };
}
export const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    req.valid = {
      ...req.valid,
      [source]: schema.parse(req[source] ?? {}),
    };
    next();
  };
}

/** Async route wrapper (Express 5 handles promises, this keeps intent explicit). */
export const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Admin session from the HttpOnly cookie. Mutating requests must also carry
 * the custom X-EV-Admin header (browsers cannot send it cross-site without a
 * CORS preflight, which we never allow) and a same-origin Origin header.
 */
export function requireAdmin({ authService, siteOrigin, additionalOrigins = [] }) {
  return async (req, _res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.get('x-ev-admin') !== '1') return next(forbidden('Missing admin request header.'));
      const origin = req.get('origin');
      if (origin && origin !== siteOrigin && !additionalOrigins.includes(origin))
        return next(forbidden('Cross-site request blocked.'));
    }
    const token = parseCookies(req.get('cookie'))[ADMIN_COOKIE];
    const user = await authService.authenticate(token);
    if (!user) return next(unauthorized());
    if (
      user.mfaRequired &&
      !['/me', '/logout', '/me/mfa/setup', '/me/mfa/confirm'].includes(req.path)
    )
      return next(forbidden('Enable authenticator MFA on your account before continuing.'));
    req.user = user;
    req.sessionToken = token;
    next();
  };
}
export const requireOwner = (req, _res, next) =>
  req.user?.role === 'owner' ? next() : next(forbidden('Only owners can do this.'));
export function sessionCookie(token, { secure, maxAgeSeconds }) {
  return [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/api/admin',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    `Max-Age=${maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join('; ');
}
export function errorHandler(logger) {
  return (err, req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: 'validation_failed',
          message:
            err.issues[0]?.message && err.issues.length === 1
              ? err.issues[0].message
              : 'Please check the highlighted fields.',
          fields: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(err.status || 400).json({
        error: {
          code: 'bad_body',
          message: 'Invalid request body.',
        },
      });
    }
    if (err?.code === 11000)
      return res.status(409).json({
        error: { code: 'duplicate', message: 'That value already exists. Reload and try again.' },
      });
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }
    logger.error('unhandled error', {
      reqId: req.id,
      path: req.path,
      err,
    });
    res.status(500).json({
      error: {
        code: 'internal',
        message: 'Something went wrong. Please try again.',
        requestId: req.id,
      },
    });
  };
}
