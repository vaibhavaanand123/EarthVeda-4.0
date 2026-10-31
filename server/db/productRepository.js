import { cleanDocument, nextSequence } from './database.js';
export function createProductRepository(db) {
  const col = db.collection('products');
  const find = async (query) => cleanDocument(await col.findOne(query));
  return {
    listLive: async () =>
      (await col.find({ archivedAt: null }).sort({ sortOrder: 1, _id: 1 }).toArray()).map(
        cleanDocument,
      ),
    listAll: async () =>
      (await col.find({}).sort({ sortOrder: 1, _id: 1 }).toArray()).map(cleanDocument),
    findById: (id) => find({ _id: id }),
    findBySlug: (slug) => find({ slug }),
    findBySku: (sku) => find({ sku }),
    async generateSku(range = 'foxnuts') {
      return `EV-${range === 'protein' ? 'PRT' : 'FNX'}-${String(await nextSequence(db, 'sku')).padStart(6, '0')}`;
    },
    async insert(product, now) {
      await db.transaction(async () => {
        await col.insertOne({
          _id: product.id,
          ...product,
          version: 1,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        for (const country of ['DE', 'GB'])
          await db.collection('inventory').insertOne({
            _id: `${country}:${product.id}`,
            productId: product.id,
            country,
            onHand: 0,
            reserved: 0,
            version: 1,
            updatedAt: now,
          });
      });
      return find({ _id: product.id });
    },
    async update(product, version, now) {
      const { id, version: _v, createdAt: _c, ...fields } = product;
      return (
        (
          await col.updateOne(
            { _id: id, version },
            { $set: { ...fields, updatedAt: now }, $inc: { version: 1 } },
          )
        ).modifiedCount === 1
      );
    },
    archive: async (id, now) =>
      (
        await col.updateOne(
          { _id: id, archivedAt: null },
          { $set: { archivedAt: now, active: false, updatedAt: now }, $inc: { version: 1 } },
        )
      ).modifiedCount === 1,
    restore: async (id, now) =>
      (
        await col.updateOne(
          { _id: id },
          { $set: { archivedAt: null, updatedAt: now }, $inc: { version: 1 } },
        )
      ).modifiedCount === 1,
  };
}
