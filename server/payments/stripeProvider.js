import Stripe from 'stripe';
import { AppError } from '../lib/errors.js';

/** Hosted card checkout, including eligible card wallets. Payment methods are
 * deliberately limited to cards until asynchronous-method reservation policy
 * is introduced. Stripe handles SCA; PCI scope still needs merchant review. */
export function createStripeProvider({ secretKey, webhookSecret, publicSiteUrl, logger, client }) {
  const stripe = client ?? new Stripe(secretKey, { maxNetworkRetries: 1, timeout: 15_000 });
  const absolute = (path) =>
    path && publicSiteUrl.startsWith('https://') ? [`${publicSiteUrl}${path}`] : undefined;

  const normaliseSession = (s) => ({
    sessionId: s.id,
    currency: s.currency?.toUpperCase(),
    orderId: s.metadata?.order_id || s.client_reference_id || null,
    status: s.status, // open | complete | expired
    paymentStatus: s.payment_status, // paid | unpaid | no_payment_required
    url: s.url || null,
    amountTotal: s.amount_total ?? null,
    amountDiscount: s.total_details?.amount_discount ?? 0,
    intentId:
      typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id || null,
    methodType:
      s.payment_intent?.latest_charge?.payment_method_details?.type ||
      s.payment_method_types?.[0] ||
      null,
    promoCode: s.discounts?.[0]?.promotion_code?.code || null,
  });

  return {
    name: 'stripe',

    async createCheckout({ order, successUrl, cancelUrl, expiresAt, idempotencyKey }) {
      const lineItems = order.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: line.unitPrice,
          product_data: {
            name: line.name,
            ...(line.picks?.length
              ? {
                  description: line.picks
                    .map((p) => `${p.quantity}× ${p.name}`)
                    .join(', ')
                    .slice(0, 500),
                }
              : {}),
            ...(absolute(line.image) ? { images: absolute(line.image) } : {}),
            metadata: { sku: line.sku },
          },
        },
      }));
      try {
        const session = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            locale: order.lang === 'de' ? 'de' : 'en-GB',
            customer_email: order.customer.email,
            client_reference_id: order.id,
            metadata: { order_id: order.id, order_number: order.orderNumber },
            payment_intent_data: {
              description: `Earthveda Essentials ${order.orderNumber}`,
              metadata: { order_id: order.id, order_number: order.orderNumber },
            },
            line_items: lineItems,
            ...(order.shipping > 0
              ? {
                  shipping_options: [
                    {
                      shipping_rate_data: {
                        type: 'fixed_amount',
                        display_name: order.lang === 'de' ? 'Versand' : 'Shipping',
                        fixed_amount: {
                          amount: order.shipping,
                          currency: order.currency.toLowerCase(),
                        },
                      },
                    },
                  ],
                }
              : {}),
            allow_promotion_codes: false,
            payment_method_types: ['card'],
            billing_address_collection: 'auto',
            submit_type: 'pay',
            expires_at: Math.floor(new Date(expiresAt).getTime() / 1000),
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
          { idempotencyKey },
        );
        return { sessionId: session.id, url: session.url };
      } catch (error) {
        logger.error('stripe checkout failed', { err: error, orderNumber: order.orderNumber });
        throw new AppError(
          502,
          'payment_unavailable',
          'Payment is temporarily unavailable. Please try again in a moment.',
        );
      }
    },

    async retrieveCheckout(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent.latest_charge', 'discounts.promotion_code'],
      });
      return normaliseSession(session);
    },

    /** Verify the signature and translate to provider-neutral events. */
    parseWebhook(rawBody, headers) {
      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, headers['stripe-signature'], webhookSecret);
      } catch {
        throw new AppError(400, 'invalid_signature', 'Invalid webhook signature.');
      }
      const object = event.data.object;
      const base = { id: event.id, rawType: event.type };
      switch (event.type) {
        case 'checkout.session.completed':
          return { ...base, type: 'checkout.completed', session: normaliseSession(object) };
        case 'checkout.session.async_payment_succeeded':
          return { ...base, type: 'checkout.completed', session: normaliseSession(object) };
        case 'checkout.session.async_payment_failed':
          return { ...base, type: 'checkout.failed', session: normaliseSession(object) };
        case 'checkout.session.expired':
          return { ...base, type: 'checkout.expired', session: normaliseSession(object) };
        case 'charge.refunded':
          return {
            ...base,
            type: 'payment.refunded',
            refund: {
              intentId:
                typeof object.payment_intent === 'string'
                  ? object.payment_intent
                  : object.payment_intent?.id,
              amountRefunded: object.amount_refunded,
              fullyRefunded: object.refunded === true,
            },
          };
        default:
          return { ...base, type: 'ignored' };
      }
    },

    async retrieveRefund(id) {
      const r = await stripe.refunds.retrieve(id);
      return { id: r.id, status: r.status, amount: r.amount };
    },
    async refundSnapshot(intentId) {
      const intent = await stripe.paymentIntents.retrieve(intentId);
      let amountRefunded = 0;
      for await (const r of stripe.refunds.list({ payment_intent: intentId, limit: 100 }))
        if (r.status === 'succeeded') amountRefunded += r.amount;
      return {
        amountRefunded,
        fullyRefunded:
          amountRefunded > 0 && amountRefunded === (intent.amount_received || intent.amount),
      };
    },
    async expireCheckout(sessionId) {
      await stripe.checkout.sessions.expire(sessionId);
    },

    async refund({ intentId, amount, orderNumber, idempotencyKey }) {
      try {
        // Stripe request idempotency is time-limited. The durable metadata key
        // also prevents duplicate refunds after a job is retried days later.
        for await (const previous of stripe.refunds.list({
          payment_intent: intentId,
          limit: 100,
        })) {
          if (previous.metadata?.refund_job_key === idempotencyKey)
            return { id: previous.id, status: previous.status, amount: previous.amount };
        }
        const refund = await stripe.refunds.create(
          {
            payment_intent: intentId,
            ...(amount ? { amount } : {}),
            metadata: { order_number: orderNumber, refund_job_key: idempotencyKey },
          },
          { idempotencyKey: idempotencyKey ?? `refund-${orderNumber}-${amount ?? 'full'}` },
        );
        return { id: refund.id, status: refund.status, amount: refund.amount };
      } catch (error) {
        logger.error('stripe refund failed', { err: error, orderNumber });
        throw new AppError(
          502,
          'refund_failed',
          'The refund could not be created. Check the payment provider and retry the queued job.',
        );
      }
    },
  };
}
