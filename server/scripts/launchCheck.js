import { CATALOG_PRICES } from '../../shared/catalog.js';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { assertConnectedBuild } from '../lib/buildReadiness.js';

// Read-only preflight. Values and secrets are never printed.
const config = loadConfig();
if (!config.isProduction)
  throw new Error(
    'Run launch:check with NODE_ENV=production and the intended production environment.',
  );
await assertConnectedBuild(config.staticDir);
const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
try {
  const issues = [];
  const schema = await db.collection('settings').findOne({ _id: '_schema' });
  if (schema?.value !== 1) issues.push('Database schema has not been initialized.');
  const business = (await db.collection('settings').findOne({ _id: 'business' }))?.value;
  for (const key of [
    'legalName',
    'street',
    'postalCode',
    'city',
    'country',
    'email',
    'foodBusinessOperator',
  ])
    if (!business?.[key]?.trim()) issues.push(`Merchant setting missing: ${key}.`);
  const products = await db
    .collection('products')
    .find({ active: true, archivedAt: null })
    .toArray();
  if (!products.length) issues.push('No published products.');
  if (!products.some((p) => p.range === 'protein'))
    issues.push('No published Plant Protein products.');
  for (const p of products) {
    if (p.range === 'protein' && p.price !== CATALOG_PRICES.protein)
      issues.push(`${p.sku}: Plant Protein price must be 1499 cents.`);
    if (!(p.netWeightGrams > 0) || !p.nutrition || !p.image)
      issues.push(`${p.sku}: weight, nutrition or product image missing.`);
    for (const lang of ['de', 'en']) {
      if (!p.i18n?.[lang]?.ingredients?.trim() || !p.i18n?.[lang]?.storage?.trim())
        issues.push(`${p.sku}: complete ${lang} product information.`);
    }
    if (p.inStock) {
      const stock = await db.collection('inventory').find({ productId: p._id }).toArray();
      if (!stock.some((s) => s.onHand > s.reserved))
        issues.push(`${p.sku}: marked available without sellable inventory.`);
    }
  }
  if (issues.length) {
    console.error('Launch check failed:\n' + issues.map((s) => `- ${s}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Launch configuration checks passed for ${products.length} published products. Payment mode: ${config.payments.mode}. Complete an end-to-end Stripe test and confirm the worker heartbeat before opening sales.`,
    );
  }
} finally {
  await db.close();
}
