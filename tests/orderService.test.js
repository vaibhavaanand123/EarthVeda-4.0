import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOrderService } from '../server/services/orderService.js';
import { silentLogger } from '../server/lib/logger.js';
function fixture(overrides = {}) {
  let order = {
    id: 'order1',
    orderNumber: 'EV-ABCDEFGH',
    status: 'pending_payment',
    currency: 'EUR',
    total: 798,
    payment: { profileId: 'DE', sessionId: 'cs_1' },
    reservationState: 'held',
    amountPaid: null,
    amountRefunded: 0,
    ...overrides,
  };
  const recorded = new Set(),
    effects = [];
  const repo = {
    findById: async () => order,
    findBySessionId: async () => order,
    recordPayment: async (value) => {
      order = {
        ...order,
        amountPaid: value.amountPaid,
        payment: { ...order.payment, intentId: value.intentId },
      };
    },
    changeStatus: async (value) => {
      order = { ...order, status: value.to };
    },
    addEvent: async () => {},
    markPaid: async (value) => {
      effects.push('stock_commit');
      order = {
        ...order,
        status: 'paid',
        reservationState: 'committed',
        amountPaid: value.amountPaid,
      };
      return true;
    },
  };
  const db = {
    transaction: async (fn) => fn(),
    collection: () => ({
      findOne: async () => null,
      updateOne: async () => {},
      find: () => ({
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        toArray: async () => [],
      }),
    }),
  };
  const jobs = { enqueue: async () => effects.push('refund_job') };
  const payments = { name: 'stripe', parseWebhook: async (body) => JSON.parse(body) };
  const service = createOrderService({
    db,
    jobs,
    orderRepository: repo,
    webhookEvents: {
      record: async (id) => {
        if (recorded.has(id)) return false;
        recorded.add(id);
        return true;
      },
    },
    catalogService: { invalidate() {} },
    payments,
    notifier: { orderPaid: async () => effects.push('notify') },
    audit: async () => {},
    logger: silentLogger,
    config: {},
    newsletterService: {},
  });
  const event = (extra) =>
    Buffer.from(
      JSON.stringify({
        id: 'evt_1',
        type: 'checkout.completed',
        profileId: 'DE',
        session: {
          sessionId: 'cs_1',
          orderId: 'order1',
          paymentStatus: 'paid',
          currency: 'EUR',
          amountTotal: 798,
          amountDiscount: 0,
          intentId: 'pi_1',
          ...extra,
        },
      }),
    );
  return { service, repo, payments, event, effects, order: () => order };
}
test('verified payment commits stock and notifies only once', async () => {
  const f = fixture();
  await f.service.handleWebhook(f.event(), {});
  const replay = await f.service.handleWebhook(f.event(), {});
  assert.deepEqual(f.effects, ['stock_commit', 'notify']);
  assert.equal(replay.duplicate, true);
});
for (const [name, extra] of [
  ['amount', { amountTotal: 1 }],
  ['currency', { currency: 'GBP' }],
  ['unapproved discount', { amountDiscount: 10 }],
  ['missing intent', { intentId: null }],
]) {
  test(`payment ${name} mismatch prevents stock commit and customer confirmation`, async () => {
    const f = fixture();
    await f.service.handleWebhook(f.event(extra), {});
    assert.equal(f.order().status, 'review_required');
    assert.deepEqual(f.effects, []);
  });
}
test('payment account binding is checked before stock commit', async () => {
  const f = fixture({ payment: { profileId: 'GB', sessionId: 'cs_1' } });
  await assert.rejects(
    f.service.handleWebhook(f.event(), {}),
    (e) => e.code === 'payment_binding_mismatch',
  );
  assert.deepEqual(f.effects, []);
});
test('late payment queues a durable refund and cannot trigger fulfilment', async () => {
  const f = fixture({ status: 'expired', reservationState: 'released' });
  await f.service.handleWebhook(f.event(), {});
  assert.equal(f.order().status, 'review_required');
  assert.deepEqual(f.effects, ['refund_job']);
});

test('a provider error for one expired order does not prevent checking the next', async () => {
  const f = fixture(),
    calls = [];
  f.repo.expiredHolds = async () => [
    { id: 'bad', payment: { sessionId: 'bad', profileId: 'DE' } },
    { id: 'order1', payment: { sessionId: 'cs_1', profileId: 'DE' } },
  ];
  f.payments.retrieveCheckout = async (id) => {
    calls.push(id);
    if (id === 'bad') throw new Error('Provider unavailable');
    return { status: 'expired', paymentStatus: 'unpaid' };
  };
  await f.service.reconcile();
  assert.deepEqual(calls, ['bad', 'cs_1']);
  assert.equal(f.order().status, 'expired');
});
