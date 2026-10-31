import express, { Router } from 'express';
import { handle, noStore } from '../middleware.js';

/** Payment provider webhooks. Needs the raw body for signature verification. */
export function webhookRouter({ orderService, logger }) {
  const router = Router();
  router.post(
    ['/stripe', '/stripe/:profile'],
    noStore,
    express.raw({
      type: '*/*',
      limit: '1mb',
    }),
    handle(async (req, res) => {
      const result = await orderService.handleWebhook(
        req.body,
        req.headers,
        req.params.profile || 'primary',
      );
      if (result.duplicate) logger.info('duplicate webhook ignored');
      res.json(result);
    }),
  );
  return router;
}
