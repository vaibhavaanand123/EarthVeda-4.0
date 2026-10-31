import { cleanDocument } from './database.js';
import { createInventoryRepository } from './inventoryRepository.js';
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function createOrderRepository(db) {
  const col = db.collection('orders');
  const inventory = createInventoryRepository(db);
  const find = async (query) => cleanDocument(await col.findOne(query));
  const addEvent = (id, from, to, note, actor, at) =>
    col.updateOne(
      { _id: id },
      { $push: { events: { from, to, note: note || null, actor, at } }, $set: { updatedAt: at } },
    );
  return {
    numberExists: async (n) =>
      Boolean(await col.findOne({ orderNumber: n }, { projection: { _id: 1 } })),
    async insert(order, now) {
      return db.transaction(async () => {
        const doc = {
          ...order,
          _id: order.id,
          createdAt: now,
          updatedAt: now,
          discount: 0,
          amountPaid: null,
          amountRefunded: 0,
          tracking: { carrier: null, number: null, url: null },
          internalNote: null,
          paidAt: null,
          reservationState: 'held',
          payment: {
            provider: order.paymentProvider,
            profileId: order.paymentProfile || 'primary',
            sessionId: null,
            intentId: null,
            methodType: null,
          },
          events: [
            { from: null, to: order.status, note: 'Order created', actor: 'customer', at: now },
          ],
        };
        doc.lines = doc.lines.map((l) => ({
          ...l,
          refId: l.kind === 'box' ? l.bundleId : l.productId,
        }));
        await inventory.reserve(doc);
        await col.insertOne(doc);
        return cleanDocument(doc);
      });
    },
    findById: (id) => find({ _id: id }),
    findByNumber: (orderNumber) => find({ orderNumber }),
    findByIdempotencyKey: (idempotencyKey) => find({ idempotencyKey }),
    findBySessionId: (sessionId) => find({ 'payment.sessionId': sessionId }),
    findByIntentId: (intentId, profileId) =>
      find({
        'payment.intentId': intentId,
        ...(profileId ? { 'payment.profileId': profileId } : {}),
      }),
    attachSession: async (id, sessionId, at) =>
      (
        await col.updateOne(
          { _id: id, 'payment.sessionId': null },
          { $set: { 'payment.sessionId': sessionId, updatedAt: at } },
        )
      ).modifiedCount === 1,
    async changeStatus({ orderId, from, to, note, actor, at }) {
      return db.transaction(async () => {
        const current = await find({ _id: orderId, status: from });
        if (!current) return false;
        const release =
          ['expired', 'payment_failed', 'cancelled', 'refunded'].includes(to) &&
          current.reservationState === 'held';
        if (release) await inventory.settle(current, false, at);
        const r = await col.updateOne(
          { _id: orderId, status: from },
          {
            $set: {
              status: to,
              updatedAt: at,
              ...(release ? { reservationState: 'released' } : {}),
            },
            $push: { events: { from, to, note: note || null, actor, at } },
          },
        );
        return r.modifiedCount === 1;
      });
    },
    async markPaid({
      orderId,
      from,
      amountPaid,
      discount,
      intentId,
      methodType,
      promoCode,
      actor,
      at,
    }) {
      return db.transaction(async () => {
        const order = await find({ _id: orderId, status: from, reservationState: 'held' });
        if (!order) return false;
        await inventory.settle(order, true, at);
        return (
          (
            await col.updateOne(
              { _id: orderId, status: from, reservationState: 'held' },
              {
                $set: {
                  status: 'paid',
                  reservationState: 'committed',
                  amountPaid,
                  discount: discount || 0,
                  paidAt: at,
                  updatedAt: at,
                  'payment.intentId': intentId,
                  'payment.methodType': methodType,
                  promoCode,
                },
                $push: {
                  events: {
                    from,
                    to: 'paid',
                    note: 'Payment verified; stock committed',
                    actor,
                    at,
                  },
                },
              },
            )
          ).modifiedCount === 1
        );
      });
    },
    recordPayment: ({ orderId, amountPaid, intentId, methodType, at }) =>
      col.updateOne(
        { _id: orderId },
        {
          $set: {
            amountPaid,
            'payment.intentId': intentId,
            'payment.methodType': methodType,
            updatedAt: at,
          },
        },
      ),
    inTransaction: (fn) => db.transaction(fn),
    recordRefund: ({ orderId, amountRefunded, at }) =>
      col.updateOne({ _id: orderId }, { $max: { amountRefunded }, $set: { updatedAt: at } }),
    setTracking: ({ orderId, carrier, number, url, at }) =>
      col.updateOne(
        { _id: orderId },
        {
          $set: {
            tracking: { carrier: carrier || null, number: number || null, url: url || null },
            updatedAt: at,
          },
        },
      ),
    setInternalNote: (id, note, at) =>
      col.updateOne({ _id: id }, { $set: { internalNote: note, updatedAt: at } }),
    addEvent,
    async list({ status, search, limit = 50, offset = 0, from, to, country } = {}) {
      const query = {};
      if (status === 'open') query.status = { $in: ['paid', 'processing', 'review_required'] };
      else if (status) query.status = status;
      if (country) query.country = country;
      if (from || to)
        query.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) };
      if (search) {
        const re = new RegExp(escaped(search.slice(0, 120)), 'i');
        query.$or = [
          { orderNumber: re },
          { 'customer.email': re },
          { 'customer.firstName': re },
          { 'customer.lastName': re },
        ];
      }
      const total = await col.countDocuments(query);
      const orders = (
        await col
          .find(query)
          .sort({ createdAt: -1, _id: 1 })
          .skip(offset)
          .limit(Math.min(limit, 200))
          .toArray()
      ).map(cleanDocument);
      return { total, orders };
    },
    async paidSince(since, limit = 50) {
      return (
        await col
          .find({ paidAt: { $gt: since } })
          .sort({ paidAt: -1 })
          .limit(limit)
          .toArray()
      ).map((o) => ({
        orderNumber: o.orderNumber,
        name: `${o.customer.firstName} ${o.customer.lastName}`,
        total: o.total,
        country: o.country,
        paidAt: o.paidAt,
      }));
    },
    async summary({ since }) {
      const byStatus = await col
        .aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { _id: 0, status: '$_id', count: 1 } },
        ])
        .toArray();
      const [r] = await col
        .aggregate([
          { $match: { paidAt: { $gte: since } } },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: { $sum: { $subtract: ['$amountPaid', '$amountRefunded'] } },
            },
          },
        ])
        .toArray();
      return { byStatus, orders: r?.orders || 0, revenue: r?.revenue || 0 };
    },
    expiredHolds: async (at) =>
      (
        await col
          .find({
            reservationState: 'held',
            status: { $ne: 'review_required' },
            reservationExpiresAt: { $lt: at },
          })
          .sort({ lastPaymentCheckAt: 1 })
          .limit(50)
          .toArray()
      ).map(cleanDocument),
  };
}
