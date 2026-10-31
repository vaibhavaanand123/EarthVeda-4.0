// Only catalogue/settings from v5. Never silently discard commerce history.
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { setupDatabase } from '../db/setup.js';
const source = process.env.LEGACY_SQLITE_PATH;
if (!source) throw new Error('Set LEGACY_SQLITE_PATH to your read-only v5 database backup.');
const sqlite = new DatabaseSync(source, { readOnly: true });
if (
  sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get().n ||
  sqlite.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n
)
  throw new Error(
    'Commerce history exists. A reviewed history migration is required before cutover; this catalogue-only importer refuses it.',
  );
const config = loadConfig(),
  db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
try {
  if (
    (await db.collection('products').countDocuments({})) ||
    (await db.collection('orders').countDocuments({}))
  )
    throw new Error('Target must be empty. Use a new database.');
  await setupDatabase(db);
  await db.transaction(async () => {
    for (const p of sqlite.prepare('SELECT * FROM products').all()) {
      await db.collection('products').insertOne({
        _id: p.id,
        slug: p.slug,
        sku: p.sku,
        range: p.range,
        accent: p.accent,
        image: p.image,
        price: p.price,
        vat: JSON.parse(p.vat),
        netWeightGrams: p.net_weight_g,
        inStock: Boolean(p.in_stock),
        active: false,
        featured: Boolean(p.featured),
        isNew: Boolean(p.is_new),
        bundleEligible: Boolean(p.bundle_eligible),
        sortOrder: p.sort_order,
        i18n: JSON.parse(p.i18n),
        nutrition: p.nutrition ? JSON.parse(p.nutrition) : null,
        version: p.version,
        archivedAt: p.archived_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      });
      for (const country of ['DE', 'GB'])
        await db.collection('inventory').insertOne({
          _id: `${country}:${p.id}`,
          productId: p.id,
          country,
          onHand: 0,
          reserved: 0,
          version: 1,
          updatedAt: p.updated_at,
        });
    }
    for (const s of sqlite.prepare('SELECT * FROM settings').all())
      await db
        .collection('settings')
        .updateOne(
          { _id: s.key },
          { $set: { value: JSON.parse(s.value), updatedAt: s.updated_at, updatedBy: 'v5-import' } },
          { upsert: true },
        );
  });
  console.log(
    'Catalogue imported as drafts with zero stock. Copy uploads, verify food data, receive actual stock, then publish.',
  );
} finally {
  sqlite.close();
  await db.close();
}
