import crypto from 'node:crypto';
import { CURRENCY, normalisePostcode, toE164 } from '../../shared/markets.js';
import { PAID_STATUSES, canSetManually, statusLabel } from '../../shared/orderStatus.js';
import { QuoteError, quoteBasket } from '../../shared/pricing.js';
import { path } from '../../shared/routes.js';
import { badRequest, conflict, notFound, AppError } from '../lib/errors.js';
import { hmac, randomOrderNumber, safeEqual } from '../lib/security.js';

export function createOrderService({
  db,
  jobs,
  orderRepository: repo,
  webhookEvents,
  catalogService: catalog,
  payments,
  notifier,
  newsletterService,
  config,
  logger,
  audit,
  now = () => new Date(),
}) {
  const iso = () => now().toISOString();
  const tx = (fn) => db.transaction(fn);
  const get = async (number) => {
    const order = await repo.findByNumber(number);
    if (!order) throw notFound('Order not found.');
    return order;
  };
  const publicView = (o) => ({
    orderNumber: o.orderNumber,
    status: o.status,
    statusLabel: statusLabel(o.status, o.lang),
    lang: o.lang,
    country: o.country,
    currency: o.currency,
    lines: o.lines.map(({ kind, name, unitPrice, quantity, lineTotal, picks }) => ({
      kind,
      name,
      unitPrice,
      quantity,
      lineTotal,
      picks: picks?.map((p) => ({ name: p.name, quantity: p.quantity })) || null,
    })),
    subtotal: o.subtotal,
    shipping: o.shipping,
    discount: o.discount,
    total: o.total,
    amountPaid: o.amountPaid,
    vat: o.vat,
    customer: { firstName: o.customer.firstName, city: o.customer.city },
    tracking: o.tracking.number || o.tracking.url ? o.tracking : null,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    timeline: o.events
      .filter((e) => e.from !== e.to)
      .map((e) => ({ status: e.to, label: statusLabel(e.to, o.lang), at: e.at })),
  });
  const fingerprintOf = (input) =>
    crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  async function quote(input) {
    await catalog.refresh(true);
    try {
      return quoteBasket(input, {
        country: input.country,
        lang: input.lang,
        resolveProduct: (id) => {
          const p = catalog.resolveProduct(id);
          return p
            ? { ...p, inStock: p.inStock && (p.stockByMarket[input.country] || 0) > 0 }
            : null;
        },
        resolveBundle: catalog.resolveBundle,
        shippingRates: catalog.shippingRates(),
      });
    } catch (e) {
      if (e instanceof QuoteError) throw badRequest(e.code, e.message, e.details);
      throw e;
    }
  }
  async function openSession(order) {
    const expiry = Date.parse(order.createdAt) + config.payments.expiresMinutes * 60000;
    if (expiry - now().getTime() < 31 * 60000)
      throw conflict('checkout_closed', 'Start a new checkout; this payment window has closed.');
    const s = await payments.createCheckout({
      order,
      successUrl: `${config.publicSiteUrl}${path('orderSuccess', order.lang)}?order=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.publicSiteUrl}${path('checkout', order.lang)}?cancelled=${order.orderNumber}`,
      expiresAt: new Date(expiry).toISOString(),
      idempotencyKey: `checkout-${order.id}`,
    });
    await repo.attachSession(order.id, s.sessionId, iso());
    return s;
  }
  async function checkoutResult(order) {
    if (order.status !== 'pending_payment')
      return { orderNumber: order.orderNumber, status: order.status, paymentUrl: null };
    const s = order.payment.sessionId
      ? await payments.retrieveCheckout(order.payment.sessionId, order.payment.profileId)
      : await openSession(order);
    if (s.status && (s.status !== 'open' || !s.url))
      throw conflict('checkout_closed', 'Start a new checkout; this payment window has closed.');
    return { orderNumber: order.orderNumber, status: order.status, paymentUrl: s.url };
  }
  async function queueRefund(order, value, reason, actor, automatic = false) {
    const key = `refund:${order.id}:${order.amountRefunded}`;
    const existing = await db.collection('jobs').findOne({ dedupeKey: key });
    if (existing && ['pending', 'sending', 'sent', 'failed'].includes(existing.status)) {
      if (existing.payload.amount !== value)
        throw conflict(
          'refund_pending',
          'Another refund request already exists. Check the jobs panel.',
        );
      return repo.findById(order.id);
    }
    const available = order.amountPaid - order.amountRefunded - (order.refundReserved || 0);
    if (!Number.isSafeInteger(value) || value <= 0 || value > available)
      throw badRequest('invalid_amount', `At most ${available} cents can be refunded now.`);
    await db.collection('orders').updateOne({ _id: order.id }, { $inc: { refundReserved: value } });
    await jobs.enqueue({
      channel: 'refund',
      template: 'refund',
      recipient: order.orderNumber,
      now: iso(),
      dedupeKey: key,
      payload: {
        orderId: order.id,
        profileId: order.payment.profileId,
        intentId: order.payment.intentId,
        amount: value,
        reason,
        automatic,
      },
    });
    await repo.addEvent(
      order.id,
      order.status,
      order.status,
      `Refund requested: ${value} cents`,
      actor,
      iso(),
    );
    await audit(actor, 'order.refund.request', 'order', order.orderNumber, { amount: value });
    return repo.findById(order.id);
  }
  async function applyRefund(order, snapshot, actor) {
    if (
      !Number.isSafeInteger(snapshot.amountRefunded) ||
      snapshot.amountRefunded < 0 ||
      snapshot.amountRefunded > order.amountPaid
    )
      throw conflict('refund_mismatch', 'Provider refund amount needs investigation.');
    const delta = Math.max(0, snapshot.amountRefunded - order.amountRefunded);
    if (!delta) return order;
    await repo.recordRefund({
      orderId: order.id,
      amountRefunded: snapshot.amountRefunded,
      at: iso(),
    });
    await db
      .collection('orders')
      .updateOne(
        { _id: order.id },
        { $set: { refundReserved: Math.max(0, (order.refundReserved || 0) - delta) } },
      );
    if (snapshot.amountRefunded === order.amountPaid && order.status !== 'refunded') {
      await repo.changeStatus({
        orderId: order.id,
        from: order.status,
        to: 'refunded',
        actor,
        at: iso(),
        note: 'Full refund confirmed by provider',
      });
      await notifier.orderStatus(await repo.findById(order.id), 'refunded');
    } else
      await repo.addEvent(
        order.id,
        order.status,
        order.status,
        `Confirmed refund total: ${snapshot.amountRefunded} cents`,
        actor,
        iso(),
      );
    return repo.findById(order.id);
  }
  async function paid(order, session, actor) {
    if (PAID_STATUSES.includes(order.status) || order.status === 'refunded') return order;
    const valid =
      session.currency === order.currency &&
      session.amountTotal === order.total &&
      !session.amountDiscount &&
      Boolean(session.intentId);
    if (!valid) {
      await repo.recordPayment({
        orderId: order.id,
        amountPaid: session.amountTotal,
        intentId: session.intentId,
        methodType: session.methodType,
        at: iso(),
      });
      await repo.changeStatus({
        orderId: order.id,
        from: order.status,
        to: 'review_required',
        actor,
        at: iso(),
        note: 'Payment amount or currency mismatch; do not fulfil',
      });
      logger.error('payment validation failed', { orderNumber: order.orderNumber });
      return repo.findById(order.id);
    }
    if (order.reservationState !== 'held') {
      await repo.recordPayment({
        orderId: order.id,
        amountPaid: session.amountTotal,
        intentId: session.intentId,
        methodType: session.methodType,
        at: iso(),
      });
      await repo.changeStatus({
        orderId: order.id,
        from: order.status,
        to: 'review_required',
        actor,
        at: iso(),
        note: 'Late payment after stock release; automatic refund queued',
      });
      const fresh = await repo.findById(order.id);
      return queueRefund(
        fresh,
        session.amountTotal,
        'Late payment after reservation release',
        'system',
        true,
      );
    }
    if (order.status === 'review_required') return order;
    const changed = await repo.markPaid({
      orderId: order.id,
      from: order.status,
      amountPaid: session.amountTotal,
      discount: 0,
      intentId: session.intentId,
      methodType: session.methodType,
      actor,
      at: iso(),
    });
    const fresh = await repo.findById(order.id);
    if (changed) await notifier.orderPaid(fresh);
    catalog.invalidate();
    return fresh;
  }
  async function handleEvent(event) {
    if (event.type === 'payment.refunded') {
      const order = await repo.findByIntentId(event.refund.intentId, event.profileId);
      if (!order)
        throw new AppError(503, 'order_not_ready', 'Order is not ready; retry the event.');
      return applyRefund(order, event.refund, 'payment-provider');
    }
    const s = event.session;
    const order = s?.orderId
      ? await repo.findById(s.orderId)
      : await repo.findBySessionId(s?.sessionId);
    if (!order) throw new AppError(503, 'order_not_ready', 'Order is not ready; retry the event.');
    if (
      order.payment.profileId !== event.profileId ||
      (order.payment.sessionId && order.payment.sessionId !== s.sessionId)
    )
      throw conflict(
        'payment_binding_mismatch',
        'Payment account or session does not match the order.',
      );
    if (!order.payment.sessionId) await repo.attachSession(order.id, s.sessionId, iso());
    if (event.type === 'checkout.completed' && s.paymentStatus === 'paid')
      return paid(order, s, 'payment-provider');
    if (
      ['checkout.expired', 'checkout.failed'].includes(event.type) &&
      order.status === 'pending_payment'
    ) {
      const to = event.type === 'checkout.expired' ? 'expired' : 'payment_failed';
      await repo.changeStatus({
        orderId: order.id,
        from: order.status,
        to,
        actor: 'payment-provider',
        at: iso(),
        note: to,
      });
      catalog.invalidate();
    }
    return repo.findById(order.id);
  }
  return {
    publicView,
    quote,
    get,
    async startCheckout(input, { idempotencyKey, clientIp }) {
      const fingerprint = fingerprintOf(input);
      let order = await repo.findByIdempotencyKey(idempotencyKey);
      if (order) {
        if (order.fingerprint !== fingerprint)
          throw conflict(
            'idempotency_mismatch',
            'This key was used with different checkout details.',
          );
        return checkoutResult(order);
      }
      if (input.country === 'GB' && config.gbPostcodeAreas.length) {
        const outward = normalisePostcode(input.customer.postalCode, 'GB').split(' ')[0];
        if (!config.gbPostcodeAreas.includes(outward))
          throw badRequest('outside_delivery_area', 'This postcode is outside our delivery area.');
      }
      const q = await quote(input);
      if (input.expectedTotal !== undefined && input.expectedTotal !== q.total)
        throw conflict(
          'price_changed',
          input.lang === 'de'
            ? 'Preise oder Versandkosten wurden aktualisiert. Bitte prüfe die neue Gesamtsumme und bestätige erneut.'
            : 'Prices or delivery costs have changed. Please review the updated total and confirm again.',
        );
      if (config.isProduction) {
        const b = catalog.settings().business;
        if (!b?.legalName || !b.street || !b.city || !b.email || !b.foodBusinessOperator)
          throw new AppError(
            503,
            'store_not_ready',
            'Checkout is not open yet. Please contact us.',
          );
      }
      const created = iso();
      try {
        order = await repo.insert(
          {
            id: crypto.randomUUID(),
            orderNumber: randomOrderNumber(),
            idempotencyKey,
            fingerprint,
            lang: input.lang,
            country: input.country,
            currency: CURRENCY,
            status: 'pending_payment',
            subtotal: q.subtotal,
            shipping: q.shipping,
            total: q.total,
            vat: q.vat.map(({ rate, amount }) => ({ rate, amount })),
            lines: q.lines,
            customer: {
              ...input.customer,
              phone: toE164(input.customer.phone, input.country),
              postalCode: normalisePostcode(input.customer.postalCode, input.country),
            },
            note: input.note,
            whatsappOptIn: input.whatsappOptIn,
            termsAcceptedAt: created,
            termsVersion: '2026-10-v6',
            reservationExpiresAt: new Date(
              Date.parse(created) + (config.payments.expiresMinutes + 2) * 60000,
            ).toISOString(),
            paymentProvider: payments.name,
            paymentProfile: payments.profileFor(input.country),
            clientIpHash: clientIp ? hmac(config.appSecret, clientIp).slice(0, 24) : null,
          },
          created,
        );
      } catch (e) {
        if (e.code !== 11000) throw e;
        order = await repo.findByIdempotencyKey(idempotencyKey);
        if (!order || order.fingerprint !== fingerprint)
          throw conflict('checkout_conflict', 'Please submit a fresh checkout.');
      }
      if (input.newsletterOptIn)
        await newsletterService.subscribe(
          { email: input.customer.email, lang: input.lang, source: 'checkout' },
          clientIp,
        );
      catalog.invalidate();
      return checkoutResult(order);
    },
    async handleWebhook(body, headers, profileId = 'primary') {
      const event = await payments.parseWebhook(body, headers, profileId);
      if (event.type === 'payment.refunded')
        event.refund = {
          intentId: event.refund.intentId,
          ...(await payments.refundSnapshot(event.refund.intentId, event.profileId)),
        };
      if (event.type === 'ignored') return { received: true, ignored: true };
      return tx(async () => {
        if (
          !(await webhookEvents.record(event.id, payments.name, event.type, iso(), event.profileId))
        )
          return { received: true, duplicate: true };
        await handleEvent(event);
        return { received: true };
      });
    },
    async statusForCustomer(number, sessionId) {
      let order = await get(number);
      if (!order.payment.sessionId || !safeEqual(order.payment.sessionId, sessionId))
        throw notFound('Order not found.');
      if (['pending_payment', 'expired', 'payment_failed'].includes(order.status)) {
        const session = await payments.retrieveCheckout(sessionId, order.payment.profileId);
        if (session.paymentStatus === 'paid')
          order = await tx(async () => paid(await repo.findById(order.id), session, 'reconcile'));
      }
      return publicView(order);
    },
    async lookup({ orderNumber, email }) {
      const o = await repo.findByNumber(orderNumber);
      const ok = safeEqual(o?.customer.email || 'absent@invalid', email);
      if (!o || !ok || ['pending_payment', 'expired'].includes(o.status))
        throw notFound('No order matches those details.');
      return publicView(o);
    },
    list: (q) => repo.list(q),
    summary: () => repo.summary({ since: new Date(now().getTime() - 30 * 86400000).toISOString() }),
    paidSince: (since) => repo.paidSince(since),
    async updateStatus(number, { status, note, notifyCustomer }, actor) {
      let order = await get(number);
      if (status === 'cancelled' && order.payment.sessionId && order.status === 'pending_payment') {
        await payments.expireCheckout(order.payment.sessionId, order.payment.profileId);
        order = await get(number);
      }
      return tx(async () => {
        const o = await get(number);
        if (o.status === status) return o;
        if ((o.refundReserved || 0) > 0)
          throw conflict('refund_pending', 'Fulfilment is on hold until the refund is confirmed.');
        if (!canSetManually(o.status, status))
          throw conflict('invalid_transition', 'This order cannot move to that status.');
        if (status === 'cancelled' && o.amountPaid > o.amountRefunded)
          throw conflict(
            'refund_first',
            'Request a refund and wait for confirmation before cancelling.',
          );
        await repo.changeStatus({
          orderId: o.id,
          from: o.status,
          to: status,
          note,
          actor,
          at: iso(),
        });
        const updated = await get(number);
        await audit(actor, 'order.status', 'order', number, { from: o.status, to: status });
        if (notifyCustomer && o.amountPaid) {
          if (status === 'shipped') await notifier.orderShipped(updated);
          else await notifier.orderStatus(updated, status, note);
        }
        catalog.invalidate();
        return updated;
      });
    },
    async setTracking(number, tracking, actor) {
      if (tracking.url && !tracking.url.startsWith('https://'))
        throw badRequest('invalid_tracking', 'Tracking links must use HTTPS.');
      return tx(async () => {
        const o = await get(number);
        await repo.setTracking({ orderId: o.id, ...tracking, at: iso() });
        await audit(actor, 'order.tracking', 'order', number, tracking);
        return get(number);
      });
    },
    async setInternalNote(number, note, actor) {
      return tx(async () => {
        const o = await get(number);
        await repo.setInternalNote(o.id, note, iso());
        await audit(actor, 'order.note', 'order', number);
        return get(number);
      });
    },
    async refund(number, { amount, reason }, actor) {
      return tx(async () => {
        const o = await get(number);
        if (!o.payment.intentId || !o.amountPaid)
          throw conflict('not_paid', 'No payment is available to refund.');
        if (o.status === 'review_required' && o.reservationState === 'held')
          throw conflict(
            'manual_review',
            'Resolve the payment mismatch with the payment provider before refunding this order.',
          );
        return queueRefund(o, amount ?? o.amountPaid - o.amountRefunded, reason, actor);
      });
    },
    async performRefundJob(message) {
      const p = message.payload,
        order = await repo.findById(p.orderId);
      const result = await payments.refund({
        profileId: p.profileId,
        intentId: p.intentId,
        amount: p.amount,
        orderNumber: order.orderNumber,
        idempotencyKey: `refund-job-${message.id}`,
      });
      if (['failed', 'cancelled'].includes(result.status))
        throw Object.assign(new Error('Provider rejected refund; investigate before retrying.'), {
          permanent: true,
        });
      const snapshot = await payments.refundSnapshot(p.intentId, p.profileId);
      await tx(async () => applyRefund(await repo.findById(p.orderId), snapshot, 'refund-worker'));
      return result;
    },
    async reconcile() {
      const attempt = async (id, field, operation) => {
        let error = null;
        try {
          await operation();
        } catch (e) {
          error = e.name || 'Error';
          logger.error('order reconciliation failed', { orderId: id, errorType: error });
        } finally {
          await db
            .collection('orders')
            .updateOne({ _id: id }, { $set: { [field]: iso(), [`${field}Error`]: error } });
        }
      };
      for (const o of await repo.expiredHolds(iso())) {
        await attempt(o.id, 'lastPaymentCheckAt', async () => {
          const s = o.payment.sessionId
            ? await payments.retrieveCheckout(o.payment.sessionId, o.payment.profileId)
            : null;
          await tx(async () => {
            const fresh = await repo.findById(o.id);
            if (s?.paymentStatus === 'paid') await paid(fresh, s, 'reconcile');
            else if (!s || s.status === 'expired')
              await repo.changeStatus({
                orderId: o.id,
                from: fresh.status,
                to: 'expired',
                actor: 'reconcile',
                at: iso(),
                note: 'Reservation expired',
              });
          });
        });
      }
      const pending = await db
        .collection('orders')
        .find({ refundReserved: { $gt: 0 }, 'payment.intentId': { $type: 'string' } })
        .sort({ lastRefundCheckAt: 1 })
        .limit(50)
        .toArray();
      for (const o of pending) {
        await attempt(o._id, 'lastRefundCheckAt', async () => {
          const pendingJobs = await db
            .collection('jobs')
            .find({ 'payload.orderId': o._id, status: 'sent', 'result.status': 'pending' })
            .toArray();
          for (const j of pendingJobs) {
            const r = await payments.retrieveRefund(j.result.id, o.payment.profileId);
            await db.collection('jobs').updateOne(
              { _id: j._id },
              {
                $set: {
                  result: r,
                  ...(['failed', 'cancelled'].includes(r.status)
                    ? {
                        status: 'failed',
                        lastError: 'Provider rejected a pending refund; investigate.',
                      }
                    : {}),
                },
              },
            );
          }
          const snapshot = await payments.refundSnapshot(o.payment.intentId, o.payment.profileId);
          await tx(async () =>
            applyRefund(await repo.findById(o._id), snapshot, 'refund-reconcile'),
          );
        });
      }
      catalog.invalidate();
    },
    async simulatePayment({ sessionId, outcome }) {
      if (payments.name !== 'mock' || config.isProduction) throw notFound();
      const order = await repo.findBySessionId(sessionId);
      if (!order) throw notFound();
      return this.handleWebhook(
        Buffer.from(JSON.stringify({ sessionId, outcome })),
        {},
        order.payment.profileId,
      );
    },
  };
}
