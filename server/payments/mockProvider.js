import crypto from 'node:crypto';
import { AppError } from '../lib/errors.js';
/** Persistent simulator, development/test only; never accepted by production config. */
export function createMockProvider({ db, profileId = 'primary', publicSiteUrl }) {
  const col = db.collection('mockSessions');
  const toSession = (s) => ({
    sessionId: s.id,
    orderId: s.orderId,
    status: s.status,
    paymentStatus: s.paymentStatus,
    url: s.url,
    amountTotal: s.amount,
    amountDiscount: 0,
    currency: s.currency,
    intentId: s.paymentStatus === 'paid' ? `pi_mock_${s.id}` : null,
    methodType: 'card',
    promoCode: null,
  });
  const find = async (id) => {
    const s = await col.findOne({ id, profileId });
    if (!s) throw new AppError(404, 'not_found', 'Unknown test session.');
    return s;
  };
  return {
    name: 'mock',
    async createCheckout({ order, idempotencyKey, expiresAt }) {
      const id = `cs_mock_${crypto.randomBytes(12).toString('hex')}`;
      const prefix = order.lang === 'en' ? '/en' : '';
      const s = await col.findOneAndUpdate(
        { _id: `${profileId}:${idempotencyKey}` },
        {
          $setOnInsert: {
            id,
            profileId,
            orderId: order.id,
            amount: order.total,
            currency: order.currency,
            status: 'open',
            paymentStatus: 'unpaid',
            refunded: 0,
            expiresAt,
            url: `${publicSiteUrl}${prefix}/checkout/mock-pay?session=${id}&order=${order.orderNumber}`,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
      return { sessionId: s.id, url: s.url };
    },
    async retrieveCheckout(id) {
      const s = await find(id);
      if (s.status === 'open' && Date.parse(s.expiresAt) < Date.now()) {
        s.status = 'expired';
        await col.updateOne({ _id: s._id }, { $set: { status: 'expired' } });
      }
      return toSession(s);
    },
    async parseWebhook(raw) {
      const body = JSON.parse(raw.toString('utf8'));
      const s = await find(body.sessionId);
      if (!['success', 'fail', 'expired'].includes(body.outcome))
        throw new AppError(400, 'invalid_outcome', 'Invalid test outcome.');
      const status = body.outcome === 'expired' ? 'expired' : 'complete';
      const paymentStatus = body.outcome === 'success' ? 'paid' : s.paymentStatus;
      await col.updateOne({ _id: s._id }, { $set: { status, paymentStatus } });
      return {
        id: body.id || `evt_mock_${crypto.randomUUID()}`,
        type:
          body.outcome === 'success'
            ? 'checkout.completed'
            : body.outcome === 'fail'
              ? 'checkout.failed'
              : 'checkout.expired',
        session: toSession({ ...s, status, paymentStatus }),
      };
    },
    async expireCheckout(id) {
      const s = await find(id);
      await col.updateOne({ _id: s._id, status: 'open' }, { $set: { status: 'expired' } });
    },
    async refund({ intentId, amount, idempotencyKey }) {
      const id = intentId.replace(/^pi_mock_/, '');
      const s = await find(id);
      const existing = await db
        .collection('mockRefunds')
        .findOne({ _id: `${profileId}:${idempotencyKey}` });
      if (existing) return existing;
      return db.transaction(async () => {
        const r = {
          _id: `${profileId}:${idempotencyKey}`,
          id: `re_mock_${crypto.randomUUID()}`,
          status: 'succeeded',
          amount,
        };
        await db.collection('mockRefunds').insertOne(r);
        await col.updateOne({ _id: s._id }, { $inc: { refunded: amount } });
        return r;
      });
    },
    async retrieveRefund(id) {
      return db.collection('mockRefunds').findOne({ id });
    },
    async refundSnapshot(intentId) {
      const s = await find(intentId.replace(/^pi_mock_/, ''));
      return { amountRefunded: s.refunded, fullyRefunded: s.refunded >= s.amount };
    },
  };
}
