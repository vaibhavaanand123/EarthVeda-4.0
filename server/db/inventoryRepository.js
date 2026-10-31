import crypto from 'node:crypto';
import { badRequest, conflict } from '../lib/errors.js';
import { cleanDocument } from './database.js';
export function stockRequirements(lines) {
  const result = new Map();
  for (const line of lines) {
    const picks =
      line.kind === 'box' ? line.picks : [{ productId: line.productId || line.refId, quantity: 1 }];
    for (const pick of picks)
      result.set(pick.productId, (result.get(pick.productId) || 0) + pick.quantity * line.quantity);
  }
  return [...result].map(([productId, quantity]) => ({ productId, quantity }));
}
export function createInventoryRepository(db) {
  const col = db.collection('inventory');
  return {
    list: async () =>
      (await col.find({}).sort({ country: 1, productId: 1 }).toArray()).map((r) => ({
        ...cleanDocument(r),
        available: r.onHand - r.reserved,
      })),
    async reserve(order) {
      for (const { productId, quantity } of stockRequirements(order.lines)) {
        const r = await col.updateOne(
          {
            _id: `${order.country}:${productId}`,
            $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, quantity] },
          },
          { $inc: { reserved: quantity, version: 1 }, $set: { updatedAt: order.createdAt } },
        );
        if (!r.modifiedCount)
          throw conflict(
            'out_of_stock',
            'A selected product has insufficient stock. Please update your bag.',
          );
      }
    },
    async settle(order, commit, at) {
      if (order.reservationState !== 'held') return;
      for (const { productId, quantity } of stockRequirements(order.lines)) {
        const r = await col.updateOne(
          { _id: `${order.country}:${productId}`, reserved: { $gte: quantity } },
          {
            $inc: { reserved: -quantity, onHand: commit ? -quantity : 0, version: 1 },
            $set: { updatedAt: at },
          },
        );
        if (!r.modifiedCount)
          throw conflict('inventory_invariant', 'Stock reservation requires operator review.');
        await db.collection('stockMovements').insertOne({
          _id: crypto.randomUUID(),
          operationId: `${commit ? 'commit' : 'release'}:${order.id}`,
          country: order.country,
          productId,
          quantity: commit ? -quantity : 0,
          reservedChange: -quantity,
          createdAt: at,
        });
      }
    },
    async adjust({ country, productId, delta, reason, operationId }, actor) {
      if (!Number.isSafeInteger(delta) || delta === 0)
        throw badRequest('invalid_stock', 'Enter a non-zero whole-unit adjustment.');
      return db.transaction(async () => {
        const existing = await db
          .collection('stockMovements')
          .findOne({ operationId, productId, country });
        if (existing) {
          if (existing.quantity !== delta || existing.reason !== reason)
            throw conflict(
              'idempotency_mismatch',
              'Stock operation already has different details.',
            );
          return cleanDocument(await col.findOne({ _id: `${country}:${productId}` }));
        }
        const row = await col.findOneAndUpdate(
          {
            _id: `${country}:${productId}`,
            $expr: { $gte: [{ $add: ['$onHand', delta] }, '$reserved'] },
          },
          { $inc: { onHand: delta, version: 1 }, $set: { updatedAt: new Date().toISOString() } },
          { returnDocument: 'after' },
        );
        if (!row)
          throw conflict(
            'stock_conflict',
            'Product not found or adjustment would consume reserved stock.',
          );
        await db.collection('stockMovements').insertOne({
          _id: crypto.randomUUID(),
          operationId,
          productId,
          country,
          quantity: delta,
          reason,
          actor,
          createdAt: new Date().toISOString(),
        });
        return cleanDocument(row);
      });
    },
  };
}
