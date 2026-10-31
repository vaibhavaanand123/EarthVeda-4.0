import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { migrateProteinPrices } from '../services/proteinPriceMigration.js';

const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== '--apply'))
  throw new Error('Usage: npm run catalog:price-protein -- [--apply]');
const config = loadConfig();
const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
try {
  const result = await migrateProteinPrices(db, { apply: flags.includes('--apply') });
  console.log(JSON.stringify(result, null, 2));
  console.log(
    result.applied
      ? 'Price changes committed. Existing orders are unchanged.'
      : 'Dry run only. Add --apply to commit these price changes.',
  );
} finally {
  await db.close();
}
