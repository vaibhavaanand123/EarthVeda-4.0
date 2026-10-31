import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { setupDatabase } from '../db/setup.js';
const config = loadConfig();
if (config.isProduction && process.argv.includes('--demo-stock'))
  throw new Error('Demo stock is forbidden in production.');
const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
try {
  await setupDatabase(db, {
    seed: process.argv.includes('--seed'),
    demoStock: process.argv.includes('--demo-stock') ? 100 : 0,
    production: config.isProduction,
  });
  console.log('Database schema and indexes ready.');
} finally {
  await db.close();
}
