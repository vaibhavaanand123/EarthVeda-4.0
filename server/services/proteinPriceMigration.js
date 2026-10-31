import crypto from 'node:crypto';
import { CATALOG_PRICES } from '../../shared/catalog.js';

/** Explicit, transactional update for catalogues seeded by an older release.
 * Historical orders and payment snapshots are deliberately immutable.
 */
export async function migrateProteinPrices(
  db,
  { apply = false, now = new Date().toISOString() } = {},
) {
  const run = async () => {
    const products = db.collection('products');
    const rows = await products
      .find({ range: 'protein', archivedAt: null })
      .sort({ _id: 1 })
      .toArray();
    const changes = rows
      .filter((p) => p.price !== CATALOG_PRICES.protein)
      .map((p) => ({
        id: p._id,
        sku: p.sku,
        from: p.price,
        to: CATALOG_PRICES.protein,
        version: p.version,
      }));
    if (apply) {
      for (const change of changes) {
        const result = await products.updateOne(
          {
            _id: change.id,
            range: 'protein',
            archivedAt: null,
            version: change.version,
            price: change.from,
          },
          { $set: { price: change.to, updatedAt: now }, $inc: { version: 1 } },
        );
        if (result.modifiedCount !== 1)
          throw new Error(
            `Product ${change.sku} changed during pricing update. No prices were committed. Retry after reviewing the catalogue.`,
          );
        await db.collection('auditLogs').insertOne({
          _id: crypto.randomUUID(),
          actor: 'release:protein-price-1499',
          action: 'product.price.migrate',
          entity: 'product',
          entityId: change.id,
          details: { from: change.from, to: change.to },
          createdAt: now,
        });
      }
    }
    return { applied: apply, matched: rows.length, changes };
  };
  return apply ? db.transaction(run) : run();
}
