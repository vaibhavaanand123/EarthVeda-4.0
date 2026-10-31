import { asPlainText, withdrawalPolicy } from '../../shared/legal.js';
import { path } from '../../shared/routes.js';

/** Compact, self-contained copy of an order for templates and webhooks. */
export const orderSnapshot = (order) => ({
  orderNumber: order.orderNumber,
  status: order.status,
  lang: order.lang,
  currency: order.currency,
  country: order.country,
  subtotal: order.subtotal,
  shipping: order.shipping,
  discount: order.discount,
  total: order.total,
  amountPaid: order.amountPaid,
  vat: order.vat,
  customer: order.customer,
  note: order.note,
  tracking: order.tracking,
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  lines: order.lines.map(({ kind, sku, name, quantity, unitPrice, lineTotal, picks }) => ({
    kind,
    sku,
    name,
    quantity,
    unitPrice,
    lineTotal,
    picks:
      picks?.map(({ name: n, quantity: q, sku: s }) => ({
        name: n,
        quantity: q,
        sku: s,
      })) ?? null,
  })),
});

/**
 * Decides WHO gets WHAT when something happens, and queues it in the outbox.
 * Delivery (and retries) is the dispatcher's job.
 */
export function createNotifier({ outbox, settings, config, now = () => new Date() }) {
  const site = config.publicSiteUrl;
  const enqueue = async (channel, template, recipient, payload, dedupeKey) =>
    await outbox.enqueue({
      channel,
      template,
      recipient,
      payload,
      dedupeKey: dedupeKey ? `${dedupeKey}:${channel}:${recipient}` : null,
      now: now().toISOString(),
    });
  const merchants = () =>
    settings().notifications || {
      merchantEmails: [],
      merchantWhatsApp: [],
    };
  const trackUrl = (order) =>
    `${site}${path('track', order.lang)}?order=${encodeURIComponent(order.orderNumber)}`;
  const base = (order) => ({
    lang: order.lang,
    siteUrl: site,
    order: orderSnapshot(order),
    trackUrl: trackUrl(order),
  });
  return {
    async orderPaid(order) {
      const business = settings().business || {};
      const eta = settings().shipping?.[order.country]?.eta?.[order.lang];
      const payload = {
        ...base(order),
        eta,
        legal: {
          termsUrl: `${site}${path('terms', order.lang)}`,
          withdrawalText: asPlainText(withdrawalPolicy(business, order.lang, site)),
        },
      };
      const key = `paid:${order.orderNumber}`;
      await enqueue('email', 'order_confirmation', order.customer.email, payload, key);
      if (order.whatsappOptIn && order.customer.phone)
        await enqueue('whatsapp', 'order_confirmation', order.customer.phone, payload, key);
      const merchantPayload = {
        ...base(order),
        adminUrl: `${site}/admin/orders/${order.orderNumber}`,
      };
      for (const email of merchants().merchantEmails)
        await enqueue('email', 'merchant_new_order', email, merchantPayload, key);
      for (const phone of merchants().merchantWhatsApp)
        await enqueue('whatsapp', 'merchant_new_order', phone, merchantPayload, key);
      await enqueue(
        'webhook',
        'order.paid',
        'webhook',
        {
          order: orderSnapshot(order),
        },
        key,
      );
    },
    async orderShipped(order) {
      const payload = base(order);
      const key = `shipped:${order.orderNumber}`;
      await enqueue('email', 'order_shipped', order.customer.email, payload, key);
      if (order.whatsappOptIn && order.customer.phone)
        await enqueue('whatsapp', 'order_shipped', order.customer.phone, payload, key);
      await enqueue(
        'webhook',
        'order.shipped',
        'webhook',
        {
          order: orderSnapshot(order),
        },
        key,
      );
    },
    async orderStatus(order, status, note = '') {
      const key = `status:${status}:${order.orderNumber}`;
      await enqueue(
        'email',
        'order_status',
        order.customer.email,
        {
          ...base(order),
          status,
          note,
        },
        key,
      );
      await enqueue(
        'webhook',
        `order.${status}`,
        'webhook',
        {
          order: orderSnapshot(order),
        },
        key,
      );
    },
    async newsletterConfirm({ email, lang, token }) {
      await enqueue('email', 'newsletter_confirm', email, {
        lang,
        siteUrl: site,
        confirmUrl: `${site}${path('newsletterConfirm', lang)}?token=${token}`,
      });
    },
    async newsletterWelcome({ email, lang, token }) {
      await enqueue(
        'email',
        'newsletter_welcome',
        email,
        {
          lang,
          siteUrl: site,
          shopUrl: `${site}${path('shop', lang)}`,
          welcomeCode: settings().newsletter?.welcomeCode || '',
          unsubscribeUrl: `${site}${path('newsletterUnsubscribe', lang)}?token=${token}`,
          unsubscribeOneClickUrl: `${site}/api/newsletter/unsubscribe?token=${token}`,
        },
        `welcome:${email}`,
      );
    },
    async withdrawal(w) {
      const payload = {
        lang: w.lang,
        siteUrl: site,
        w,
        adminUrl: `${site}/admin/withdrawals`,
      };
      await enqueue('email', 'withdrawal_receipt', w.email, payload, `withdrawal:${w.reference}`);
      for (const email of merchants().merchantEmails)
        await enqueue('email', 'merchant_withdrawal', email, payload, `withdrawal:${w.reference}`);
      await enqueue(
        'webhook',
        'withdrawal.received',
        'webhook',
        {
          withdrawal: w,
        },
        `withdrawal:${w.reference}`,
      );
    },
  };
}
