import crypto from 'node:crypto';
import { hmac } from '../lib/security.js';

/**
 * Online withdrawal function (§ 356a BGB, in force since 19 June 2026).
 * Every declaration is accepted and acknowledged; whether it is legally
 * effective (period, exceptions) is checked by the team afterwards.
 */
export function createWithdrawalService({
  db,
  withdrawalRepository,
  notifier,
  config,
  audit,
  now = () => new Date(),
}) {
  const service = {
    async submit({ name, orderNumber, email, scope, lang }, clientIp) {
      const reference = `WR-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      const withdrawal = await withdrawalRepository.insert({
        reference,
        orderNumber: orderNumber.toUpperCase(),
        name,
        email,
        scope,
        lang,
        ipHash: clientIp ? hmac(config.appSecret, clientIp).slice(0, 24) : null,
        now: now().toISOString(),
      });
      await notifier.withdrawal(withdrawal);
      return {
        reference: withdrawal.reference,
        receivedAt: withdrawal.createdAt,
      };
    },
    list: async (query) => await withdrawalRepository.list(query),
    async setHandled(id, handled, actor) {
      const ok = await withdrawalRepository.setHandled(id, handled);
      if (ok)
        await audit(actor, 'withdrawal.handled', 'withdrawal', String(id), {
          handled,
        });
      return ok;
    },
  };
  for (const name of ['submit', 'setHandled']) {
    const fn = service[name];
    service[name] = (...args) => db.transaction(() => fn(...args));
  }
  return service;
}
