import { hmac, randomToken, sha256 } from '../lib/security.js';
const CONSENT = {
  de: 'Ich möchte den Earthveda Newsletter mit Neuigkeiten, Rezepten und Angeboten per E-Mail erhalten. Abmeldung jederzeit möglich.',
  en: 'I would like to receive the Earthveda newsletter with news, recipes and offers by email. I can unsubscribe at any time.',
};

/**
 * Double opt-in newsletter with recorded consent. The response never reveals
 * whether an address is already subscribed.
 */
export function createNewsletterService({
  db,
  subscriberRepository,
  notifier,
  config,
  audit,
  now = () => new Date(),
}) {
  const iso = () => now().toISOString();
  const service = {
    consentText: (lang) => CONSENT[lang] || CONSENT.de,
    async subscribe({ email, lang, source }, clientIp) {
      const token = randomToken(24);
      const tokenHash = sha256(token);
      const ipHash = clientIp ? hmac(config.appSecret, clientIp).slice(0, 24) : null;
      const existing = await subscriberRepository.findByEmail(email);
      const record = {
        email,
        lang,
        source,
        tokenHash,
        consentText: CONSENT[lang],
        ipHash,
        now: iso(),
      };
      if (existing?.status === 'confirmed') return; // silently succeed
      if (existing)
        await subscriberRepository.resetPending({
          id: existing.id,
          ...record,
        });
      else await subscriberRepository.insert(record);
      await notifier.newsletterConfirm({
        email,
        lang,
        token,
      });
    },
    async confirm(token) {
      const subscriber = await subscriberRepository.findByTokenHash(sha256(token));
      if (!subscriber || subscriber.status === 'unsubscribed')
        return {
          ok: false,
        };
      if (
        subscriber.status === 'pending' &&
        Date.parse(subscriber.createdAt) + 72 * 3600000 < now().getTime()
      )
        return { ok: false };
      if (subscriber.status === 'confirmed')
        return {
          ok: true,
          already: true,
        };
      // The same token later powers the unsubscribe link in every mail.
      await subscriberRepository.confirm(subscriber.id, iso());
      await notifier.newsletterWelcome({
        email: subscriber.email,
        lang: subscriber.lang,
        token,
      });
      return {
        ok: true,
      };
    },
    async unsubscribe(token) {
      const subscriber = await subscriberRepository.findByTokenHash(sha256(token));
      if (!subscriber)
        return {
          ok: false,
        };
      await subscriberRepository.unsubscribe(subscriber.id, iso());
      return {
        ok: true,
      };
    },
    list: async (query) => await subscriberRepository.list(query),
    async remove(id, actor) {
      const ok = await subscriberRepository.remove(id);
      if (ok) await audit(actor, 'subscriber.delete', 'subscriber', String(id));
      return ok;
    },
  };
  for (const name of ['subscribe', 'confirm', 'unsubscribe', 'remove']) {
    const fn = service[name];
    service[name] = (...args) => db.transaction(() => fn(...args));
  }
  return service;
}
